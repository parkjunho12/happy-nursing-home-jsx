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
from app.models.resident_docs import ResidentDocStatus, ResidentDocChange, now_kst
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


def _derive_care(certs: list) -> str:
    """인정서 → 구분. 시설급여가 하나라도 있으면 '시설', 없으면 등급외/재가."""
    for c in certs or []:
        for b in (c.get("benefits") or []):
            if "시설" in (b.get("type") or ""):
                return "시설"
    graded = any((c.get("grade") and c.get("grade") != "등급외") for c in (certs or []))
    return "재가" if graded else "등급외"


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
    if role != "ADMIN" and pos not in ("사회복지사", "시설장", "대표", "이사"):
        raise HTTPException(403, "어르신 서류 현황 권한이 없습니다. (관리자·사회복지사·시설장·대표·이사)")
    return current_user


def _view(r: ResidentDocStatus, rooms: dict | None = None) -> dict:
    return {
        "id": r.id, "resident_id": r.resident_id, "floor": r.floor, "seq": r.seq,
        "room": (rooms or {}).get(r.resident_id),   # 호실 — 수급자 명단에서 연동
        "name": r.name, "admission_date": r.admission_date, "grade": r.grade,
        "base_date": r.base_date,
        "cert_periods": r.cert_periods or [],
        "certifications": (r.certifications if r.certifications else _synth_certs(r.cert_periods)) or [],
        "contract_lines": r.contract_lines or [],
        "care_type": r.care_type or "시설",
        "followup_date": r.followup_date,
        "apply_stage": r.apply_stage,
        "apply_note": r.apply_note,
        "guardian_notified_at": r.guardian_notified_at,
        "plan_lines": r.plan_lines or [],
        "eval_lines": r.eval_lines or [],
        "memo": r.memo, "active": bool(r.active),
    }


class DocBody(BaseModel):
    resident_id: Optional[str] = None
    floor: Optional[str] = None
    care_type: Optional[str] = None
    followup_date: Optional[str] = None
    apply_stage: Optional[str] = None
    apply_note: Optional[str] = None
    guardian_notified_at: Optional[str] = None
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
    if b.followup_date is not None: r.followup_date = b.followup_date or None
    if b.apply_stage is not None: r.apply_stage = b.apply_stage or None
    if b.apply_note is not None: r.apply_note = b.apply_note or None
    if b.guardian_notified_at is not None: r.guardian_notified_at = b.guardian_notified_at or None
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
        # 구분은 입력받지 않고 인정서에서 도출한다 (손입력과 인정서가 어긋나지 않도록)
        care = _derive_care(certs)
        r.care_type = care
        if care == "시설":
            # 시설급여 인정서가 생겼다 = 신청이 끝났다는 뜻
            if r.apply_stage and r.apply_stage != "완료":
                r.apply_stage = "완료"
        elif not r.apply_stage:
            r.apply_stage = "예정"
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
                    st = (x.get("status") or "").strip() or None
                    # status가 오면 done을 거기에 맞춘다 (레거시 화면 호환)
                    done = True if st == "완료" else (bool(x.get("done")) if st is None else False)
                    if st is None and done:
                        st = "완료"
                    if d or mm:
                        cleaned.append({"date": d, "memo": mm, "kind": k, "done": done, "status": st})
                elif isinstance(x, str) and x.strip():
                    cleaned.append({"date": None, "memo": x.strip(), "kind": None})
            setattr(r, col, cleaned)


# ── 수정 이력(diff) ──────────────────────────────────────────────────
# 저장 전/후를 사람이 읽을 수 있는 문자열로 요약해 비교한다.
_SCALARS = [
    ("name", "성함"), ("floor", "층"), ("care_type", "구분(자동)"), ("admission_date", "입소일"),
    ("followup_date", "다음 확인일"), ("apply_stage", "신청 단계"),
    ("apply_note", "진행 메모"), ("guardian_notified_at", "보호자 안내일"),
    ("grade", "등급/급여"), ("base_date", "기준일"), ("memo", "메모"),
]
_LISTS = [
    ("certifications", "인정서"), ("contract_lines", "계약서 일시"),
    ("plan_lines", "급여제공계획서 일시"), ("eval_lines", "결과평가 일시"),
]


def _cert_label(c: dict) -> str:
    g = (c.get("grade") or "").strip()
    g = "등급외" if g == "등급외" else (f"{g}등급" if g else "")
    span = "~".join([x for x in [(c.get("start") or ""), (c.get("end") or "")] if x])
    bens = "·".join([(b.get("type") or "") for b in (c.get("benefits") or []) if b.get("type")])
    return " ".join([x for x in [g, span, bens] if x]) or "(빈 인정서)"


def _line_label(x) -> str:
    if isinstance(x, str):
        return x.strip()
    if not isinstance(x, dict):
        return str(x)
    parts = [(x.get("date") or "").strip(), (x.get("kind") or "").strip(), (x.get("memo") or "").strip()]
    return " ".join([p for p in parts if p]) or "(빈 항목)"


def _labels(field: str, val) -> list:
    fn = _cert_label if field == "certifications" else _line_label
    return [fn(v) for v in (val or [])]


def _snapshot(r: ResidentDocStatus) -> dict:
    snap = {f: (getattr(r, f) if getattr(r, f) not in (None, "") else None) for f, _ in _SCALARS}
    snap["active"] = bool(r.active) if r.active is not None else True
    for f, _ in _LISTS:
        snap[f] = _labels(f, getattr(r, f))
    return snap


def _multiset_diff(before: list, after: list):
    """중복을 고려한 추가/삭제 목록."""
    rem = list(before)
    added = []
    for x in after:
        if x in rem:
            rem.remove(x)
        else:
            added.append(x)
    return added, rem


def _diff(before: dict, after: dict) -> list:
    out = []
    for f, label in _SCALARS:
        if before.get(f) != after.get(f):
            out.append({"field": f, "label": label, "before": before.get(f), "after": after.get(f)})
    if before.get("active") != after.get("active"):
        out.append({"field": "active", "label": "상태", "before": "재원" if before.get("active") else "퇴소",
                    "after": "재원" if after.get("active") else "퇴소"})
    for f, label in _LISTS:
        added, removed = _multiset_diff(before.get(f) or [], after.get(f) or [])
        if added or removed:
            out.append({"field": f, "label": label, "added": added, "removed": removed})
    return out


def _log(db: Session, r: ResidentDocStatus, user: User, action: str, changes: list):
    """변경 사항이 있을 때만 이력을 남긴다."""
    if not changes:
        return
    db.add(ResidentDocChange(
        doc_id=r.id, resident_name=r.name, action=action, changes=changes,
        user_id=getattr(user, "id", None),
        user_name=getattr(user, "name", None) or getattr(user, "username", None) or "알 수 없음",
        created_at=now_kst(),
    ))


def _change_view(c: ResidentDocChange) -> dict:
    return {
        "id": c.id, "doc_id": c.doc_id, "resident_name": c.resident_name,
        "action": c.action or "update", "changes": c.changes or [],
        "user_name": c.user_name, "created_at": c.created_at.isoformat() if c.created_at else None,
    }


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
    # 호실 — 수급자 명단에서 한 번에 가져와 붙인다
    from app.models.eval import LtcResident
    rooms = {rr.id: rr.room for rr in db.query(LtcResident).all() if rr.room}
    return ApiResponse(success=True, data=[_view(r, rooms) for r in rows])


@router.post("/records")
def create_record(b: DocBody, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    r = ResidentDocStatus()
    _apply(r, b)
    if b.resident_id:
        r.resident_id = b.resident_id
    db.add(r); db.flush()
    _log(db, r, current_user, "create", _diff(_snapshot(ResidentDocStatus()), _snapshot(r)) or
         [{"field": "_new", "label": "등록", "before": None, "after": r.name or "신규 기록"}])
    db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.patch("/records/{rid}")
def update_record(rid: str, b: DocBody, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    r = db.query(ResidentDocStatus).filter(ResidentDocStatus.id == rid).first()
    if not r:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    before = _snapshot(r)
    _apply(r, b)
    r.updated_at = now_kst()
    _log(db, r, current_user, "update", _diff(before, _snapshot(r)))
    db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.delete("/records/{rid}")
def delete_record(rid: str, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    r = db.query(ResidentDocStatus).filter(ResidentDocStatus.id == rid).first()
    if not r:
        raise HTTPException(404, "기록을 찾을 수 없습니다.")
    _log(db, r, current_user, "delete", [{"field": "_deleted", "label": "기록 삭제",
                                          "before": r.name or "(이름 없음)", "after": None}])
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.get("/records/{rid}/changes")
def list_changes(rid: str, limit: int = Query(50, le=200),
                 db: Session = Depends(get_db), current_user: User = Depends(_require)):
    """어르신 한 명의 수정 이력 (최신순)."""
    rows = (db.query(ResidentDocChange).filter(ResidentDocChange.doc_id == rid)
            .order_by(ResidentDocChange.created_at.desc()).limit(limit).all())
    return ApiResponse(success=True, data=[_change_view(c) for c in rows])


@router.get("/changes")
def recent_changes(limit: int = Query(30, le=200),
                   db: Session = Depends(get_db), current_user: User = Depends(_require)):
    """전체 최근 수정 이력 (최신순)."""
    rows = (db.query(ResidentDocChange)
            .order_by(ResidentDocChange.created_at.desc()).limit(limit).all())
    return ApiResponse(success=True, data=[_change_view(c) for c in rows])
