"""
어르신 서류 현황(인정서·계약서·급여제공계획서·평가) API.
권한: ADMIN · 사회복지사 · 시설장
"""
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.resident_docs import ResidentDocStatus, now_kst
from app.schemas.response import ApiResponse

router = APIRouter()


# ── 인정서(certifications) 정규화/파생 ────────────────────────────────
def _clean_certs(raw) -> list:
    out = []
    for c in (raw or []):
        if not isinstance(c, dict):
            continue
        start = (c.get("start") or "").strip() or None
        end = (c.get("end") or "").strip() or None
        grade = (c.get("grade") or "").strip() or None
        cert_no = (c.get("cert_no") or "").strip() or None
        bens = []
        for b in (c.get("benefits") or []):
            if not isinstance(b, dict):
                continue
            ty = (b.get("type") or "").strip() or None
            fr = (b.get("from") or "").strip() or None
            if ty:
                bens.append({"type": ty, "from": fr or start})
        if start or end or grade or bens:
            out.append({"grade": grade, "cert_no": cert_no, "start": start, "end": end, "benefits": bens})
    return out


def _current_cert(certs: list):
    if not certs:
        return None
    return max(certs, key=lambda c: (c.get("end") or c.get("start") or ""))


def _derive_from_certs(certs: list):
    """certifications → (cert_periods flatten, grade 요약, base_date)."""
    periods = []
    for c in certs:
        bens = c.get("benefits") or []
        if bens:
            for b in bens:
                periods.append({"start": b.get("from") or c.get("start"), "end": c.get("end"),
                                "type": b.get("type"), "level": c.get("grade")})
        else:
            periods.append({"start": c.get("start"), "end": c.get("end"), "type": None, "level": c.get("grade")})
    cur = _current_cert(certs)
    glines, seen = [], set()
    if cur:
        g = cur.get("grade")
        for b in (cur.get("benefits") or []):
            ty = b.get("type")
            key = "등급외" if g == "등급외" else f"{g}/{ty}"
            if key in seen:
                continue
            seen.add(key)
            glines.append("등급외" if g == "등급외" else f"{g}/{ty}")
        if not (cur.get("benefits") or []) and g:
            glines.append("등급외" if g == "등급외" else f"{g}")
    grade = "\n".join(glines) or None
    base = cur.get("start") if cur else None
    return periods, grade, base


def _synth_certs(periods) -> list:
    """(legacy) cert_periods → certifications 형태로 변환(표시용)."""
    out = []
    for p in (periods or []):
        if not isinstance(p, dict):
            continue
        ty = p.get("type")
        out.append({
            "grade": p.get("level"), "cert_no": None,
            "start": p.get("start"), "end": p.get("end"),
            "benefits": ([{"type": ty, "from": p.get("start")}] if ty else []),
        })
    return out


def _require(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos not in ("사회복지사", "시설장"):
        raise HTTPException(403, "어르신 서류 현황 권한이 없습니다. (관리자·사회복지사·시설장)")
    return current_user


def _view(r: ResidentDocStatus) -> dict:
    return {
        "id": r.id, "resident_id": r.resident_id, "floor": r.floor, "seq": r.seq,
        "name": r.name, "admission_date": r.admission_date, "grade": r.grade,
        "base_date": r.base_date,
        "cert_periods": r.cert_periods or [],
        "certifications": (r.certifications if r.certifications else _synth_certs(r.cert_periods)) or [],
        "contract_lines": r.contract_lines or [],
        "plan_lines": r.plan_lines or [],
        "eval_lines": r.eval_lines or [],
        "memo": r.memo, "active": bool(r.active),
    }


class DocBody(BaseModel):
    resident_id: Optional[str] = None
    floor: Optional[str] = None
    name: Optional[str] = None
    admission_date: Optional[str] = None
    grade: Optional[str] = None
    base_date: Optional[str] = None
    cert_periods: Optional[list] = None
    certifications: Optional[list] = None
    contract_lines: Optional[list] = None
    plan_lines: Optional[list] = None
    eval_lines: Optional[list] = None
    memo: Optional[str] = None
    active: Optional[bool] = None


def _apply(r: ResidentDocStatus, b: DocBody):
    if b.floor is not None: r.floor = b.floor or None
    if b.name is not None: r.name = b.name or None
    if b.admission_date is not None: r.admission_date = b.admission_date or None
    if b.grade is not None: r.grade = b.grade or None
    if b.base_date is not None: r.base_date = b.base_date or None
    if b.memo is not None: r.memo = b.memo or None
    if b.active is not None: r.active = bool(b.active)
    if b.certifications is not None:
        certs = _clean_certs(b.certifications)
        r.certifications = certs
        periods, grade, base = _derive_from_certs(certs)
        r.cert_periods = periods
        r.grade = grade
        # base_date: 사용자가 명시 안 했으면 현재 인정서 시작일로 자동
        if base and not (b.base_date and str(b.base_date).strip()):
            r.base_date = base
    elif b.cert_periods is not None:
        cleaned = []
        for c in b.cert_periods:
            if isinstance(c, dict):
                st = (c.get("start") or "").strip() or None
                en = (c.get("end") or "").strip() or None
                ty = (c.get("type") or "").strip() or None
                lv = (c.get("level") or "").strip() or None
                if st or en or ty:
                    cleaned.append({"start": st, "end": en, "type": ty, "level": lv})
        r.cert_periods = cleaned
    for key, col in (("contract_lines", "contract_lines"), ("plan_lines", "plan_lines"), ("eval_lines", "eval_lines")):
        val = getattr(b, key)
        if val is not None:
            cleaned = []
            for x in val:
                if isinstance(x, dict):
                    d = (x.get("date") or "").strip() or None
                    mm = (x.get("memo") or "").strip() or None
                    k = (x.get("kind") or "").strip() or None
                    if d or mm:
                        cleaned.append({"date": d, "memo": mm, "kind": k})
                elif isinstance(x, str) and x.strip():
                    cleaned.append({"date": None, "memo": x.strip(), "kind": None})
            setattr(r, col, cleaned)


@router.get("/records")
def list_records(include_inactive: bool = False, floor: Optional[str] = Query(None),
                 db: Session = Depends(get_db), current_user: User = Depends(_require)):
    q = db.query(ResidentDocStatus)
    if not include_inactive:
        q = q.filter((ResidentDocStatus.active == True) | (ResidentDocStatus.active.is_(None)))  # noqa: E712
    if floor:
        q = q.filter(ResidentDocStatus.floor == floor)
    rows = q.all()
    # 이름 ㄱㄴㄷ 정렬 (파이썬 로케일 무관 코드포인트로도 한글은 가나다순)
    rows.sort(key=lambda r: (r.name or "￿"))
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@router.post("/records")
def create_record(b: DocBody, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    r = ResidentDocStatus()
    _apply(r, b)
    if b.resident_id:
        r.resident_id = b.resident_id
    db.add(r); db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.patch("/records/{rid}")
def update_record(rid: str, b: DocBody, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    r = db.query(ResidentDocStatus).filter(ResidentDocStatus.id == rid).first()
    if not r:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    _apply(r, b)
    r.updated_at = now_kst()
    db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.delete("/records/{rid}")
def delete_record(rid: str, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    r = db.query(ResidentDocStatus).filter(ResidentDocStatus.id == rid).first()
    if not r:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")
