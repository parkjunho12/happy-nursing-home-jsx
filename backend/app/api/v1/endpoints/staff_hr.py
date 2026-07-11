"""
직원 근로계약·서류제출 관리(HR) API.
권한: ADMIN · 사회복지사
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staff_hr import StaffHrRecord, DOC_FIELDS, now_kst, minus_one_month, contract_end_3m, to_iso
from app.schemas.response import ApiResponse

router = APIRouter()

DOC_KEYS = [k for k, _ in DOC_FIELDS]


def _require_hr(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos not in ("시설장", "대표", "이사"):
        raise HTTPException(403, "직원 상세 관리 권한이 없습니다. (관리자·시설장·대표·이사)")
    return current_user


def _view(r: StaffHrRecord) -> dict:
    return {
        "id": r.id, "seq": r.seq, "staff_id": r.staff_id, "active": bool(r.active), "hire_date": r.hire_date, "name": r.name,
        "position": r.position, "contract_period": r.contract_period,
        "contracts": r.contracts or [],
        "contract_written": bool(r.contract_written), "renewal_date": r.renewal_date, "note": r.note,
        "docs": {
            "health": r.doc_health, "criminal": r.doc_criminal, "cert": r.doc_cert,
            "resident": r.doc_resident, "family": r.doc_family, "id_copy": r.doc_id_copy,
            "bankbook": r.doc_bankbook, "insurance": r.doc_insurance,
            "withholding": r.doc_withholding, "subholiday": r.doc_subholiday,
            "compleave": r.doc_compleave, "privacy": r.doc_privacy,
        },
        "doc_note": r.doc_note,
    }


@router.get("/meta")
def meta(current_user: User = Depends(_require_hr)):
    return ApiResponse(success=True, data={"doc_fields": [{"key": k, "label": l} for k, l in DOC_FIELDS]})


@router.get("/records")
def list_records(include_inactive: bool = False, db: Session = Depends(get_db), current_user: User = Depends(_require_hr)):
    q = db.query(StaffHrRecord)
    if not include_inactive:
        q = q.filter((StaffHrRecord.active == True) | (StaffHrRecord.active.is_(None)))  # noqa: E712
    rows = q.order_by(StaffHrRecord.hire_date.asc(), StaffHrRecord.name.asc()).all()
    return ApiResponse(success=True, data=[_view(r) for r in rows])


class HrBody(BaseModel):
    seq: Optional[int] = None
    hire_date: Optional[str] = None
    name: Optional[str] = None
    position: Optional[str] = None
    contract_period: Optional[str] = None
    contracts: Optional[list] = None
    contract_written: Optional[bool] = None
    renewal_date: Optional[str] = None
    note: Optional[str] = None
    docs: Optional[dict] = None
    doc_note: Optional[str] = None
    active: Optional[bool] = None


_minus_one_month = minus_one_month


def _apply(r: StaffHrRecord, body: HrBody):
    if body.seq is not None: r.seq = body.seq
    if body.hire_date is not None: r.hire_date = body.hire_date or None
    if body.name is not None: r.name = body.name or None
    if body.position is not None: r.position = body.position or None
    if body.contract_period is not None: r.contract_period = body.contract_period or None
    if body.contracts is not None:
        # [{start,end}] 정규화(빈 항목 제거)
        cleaned = []
        for c in body.contracts:
            if not isinstance(c, dict):
                continue
            st = (c.get("start") or "").strip() or None
            en = (c.get("end") or "").strip() or None
            if st or en:
                cleaned.append({"start": st, "end": en})
        r.contracts = cleaned
        # 재계약일 자동: 최신 계약 종료일 1개월 전
        ends = [c["end"] for c in cleaned if c.get("end")]
        if ends:
            r.renewal_date = _minus_one_month(max(ends))
    if body.contract_written is not None: r.contract_written = bool(body.contract_written)
    if body.renewal_date is not None: r.renewal_date = (body.renewal_date or "").strip() or None
    if body.note is not None: r.note = body.note or None
    if body.doc_note is not None: r.doc_note = body.doc_note or None
    if body.active is not None: r.active = bool(body.active)
    if body.docs is not None:
        m = {"health": "doc_health", "criminal": "doc_criminal", "cert": "doc_cert",
             "resident": "doc_resident", "family": "doc_family", "id_copy": "doc_id_copy",
             "bankbook": "doc_bankbook", "insurance": "doc_insurance",
             "withholding": "doc_withholding", "subholiday": "doc_subholiday",
             "compleave": "doc_compleave", "privacy": "doc_privacy"}
        for k, col in m.items():
            if k in body.docs:
                v = body.docs[k]
                setattr(r, col, None if v is None else bool(v))


@router.post("/records")
def create_record(body: HrBody, db: Session = Depends(get_db), current_user: User = Depends(_require_hr)):
    if body.seq is None:
        mx = db.query(StaffHrRecord).order_by(StaffHrRecord.seq.desc()).first()
        body.seq = (mx.seq + 1) if mx and mx.seq else 1
    r = StaffHrRecord()
    _apply(r, body)
    # 신규 입사자: 계약이 없고 입사일이 있으면 3개월 기본 계약 자동 생성
    if (not r.contracts) and r.hire_date:
        hd = to_iso(r.hire_date) or r.hire_date
        r.hire_date = hd
        end = contract_end_3m(hd)
        r.contracts = [{"start": hd, "end": end}]
        if end:
            r.renewal_date = minus_one_month(end)
    db.add(r); db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.patch("/records/{rid}")
def update_record(rid: str, body: HrBody, db: Session = Depends(get_db), current_user: User = Depends(_require_hr)):
    r = db.query(StaffHrRecord).filter(StaffHrRecord.id == rid).first()
    if not r:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    _apply(r, body)
    r.updated_at = now_kst()
    db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.delete("/records/{rid}")
def delete_record(rid: str, db: Session = Depends(get_db), current_user: User = Depends(_require_hr)):
    r = db.query(StaffHrRecord).filter(StaffHrRecord.id == rid).first()
    if not r:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")
