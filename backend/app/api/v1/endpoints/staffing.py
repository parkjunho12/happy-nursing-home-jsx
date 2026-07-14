"""
요양보호사 인력배치 및 입소 가능성 시뮬레이터 API.
권한: ADMIN · 시설장
"""
from __future__ import annotations
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcResident, LtcStaffMember
from app.models.staffing import HolidayCalendar, StaffMonthlyHours
from app.schemas.response import ApiResponse
from app.services import staffing as S

router = APIRouter()

CAREGIVER_POSITIONS = ("요양보호사", "요양팀장", "요양보호원")


def _is_caregiver(pos) -> bool:
    p = (pos or "").replace(" ", "").strip()
    return p in CAREGIVER_POSITIONS or "요양보호" in p


def _require(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "인력배치 시뮬레이터 권한이 없습니다. (관리자·시설장)")
    return current_user


def _holiday_table(db: Session) -> list:
    try:
        rows = db.query(HolidayCalendar).filter(HolidayCalendar.active == True).all()  # noqa: E712
        return [{"date": r.date, "name": r.name} for r in rows]
    except Exception:
        return []


def _current_residents(db: Session) -> list:
    rows = db.query(LtcResident).filter(LtcResident.admission_date.isnot(None)).all()
    out = []
    for r in rows:
        if r.status == "discharged" and not r.discharge_date:
            continue
        out.append({"name": r.name, "admission_date": r.admission_date,
                    "discharge_date": r.discharge_date, "status": r.status})
    return out


def _hour_overrides(db: Session, year: int, month: int) -> dict:
    """직원별 저장된 월간 인정시간 조정값 {staff_id: hours}"""
    try:
        rows = db.query(StaffMonthlyHours).filter(
            StaffMonthlyHours.year == year, StaffMonthlyHours.month == month
        ).all()
        return {r.staff_id: float(r.hours) for r in rows}
    except Exception:
        return {}


def _apply_overrides(workers: list, ov: dict) -> list:
    """저장된 조정값이 있으면 자동 계산 대신 그 값을 사용한다."""
    out = []
    for w in workers:
        w = dict(w)
        sid = w.get("employee_id")
        if sid and sid in ov:
            w["recognized_work_hours"] = ov[sid]
        out.append(w)
    return out


def _current_caregivers(db: Session) -> list:
    rows = db.query(LtcStaffMember).filter(LtcStaffMember.status == "active").all()
    out = []
    for s in rows:
        if not _is_caregiver(s.position):
            continue
        out.append({"employee_id": s.id, "name": s.name, "hire_date": s.hire_date,
                    "resign_date": s.resign_date, "is_expected_hire": False,
                    "position": s.position, "leaves": s.leaves or []})
    return out


@router.get("/context")
def context(year: Optional[int] = Query(None), month: Optional[int] = Query(None),
            db: Session = Depends(get_db), _: User = Depends(_require)):
    today = date.today()
    y = year or today.year
    m = month or today.month
    residents = [r for r in _current_residents(db) if r["status"] == "active"]
    workers = _current_caregivers(db)
    overrides = _hour_overrides(db, y, m)
    hol = S.get_korean_holidays(y, None, _holiday_table(db))
    std = S.calculate_monthly_standard_hours(y, m, set(hol.keys()), S.DEFAULT_CONFIG["daily_hours"])
    return ApiResponse(success=True, data={
        "year": y, "month": m,
        "config": S.DEFAULT_CONFIG,
        "residents": residents,
        "workers": workers,
        "hour_overrides": overrides,
        "caregiver_count": len(workers),
        "resident_count": len(residents),
        "monthly_standard_detail": std,
        "applied_holidays": [{"date": d, "name": hol[d]} for d in std["applied_holiday_dates"]],
    })


class SimBody(BaseModel):
    year: int
    month: int
    as_of: Optional[str] = None
    config: Optional[dict] = None
    residents: Optional[List[dict]] = None
    workers: Optional[List[dict]] = None
    planned_admissions: Optional[List[dict]] = None
    candidates: Optional[List[dict]] = None
    extra_excluded_dates: Optional[List[str]] = None
    use_db_residents: Optional[bool] = True
    use_db_workers: Optional[bool] = True


@router.post("/simulate")
def simulate(body: SimBody, db: Session = Depends(get_db), _: User = Depends(_require)):
    residents = body.residents
    if residents is None and body.use_db_residents:
        residents = [r for r in _current_residents(db) if r["status"] == "active"]
    workers = body.workers
    if workers is None and body.use_db_workers:
        workers = _apply_overrides(_current_caregivers(db), _hour_overrides(db, body.year, body.month))

    payload = {
        "year": body.year, "month": body.month, "as_of": body.as_of,
        "config": body.config or {},
        "residents": residents or [],
        "workers": workers or [],
        "planned_admissions": body.planned_admissions or [],
        "candidates": body.candidates or [],
        "extra_excluded_dates": body.extra_excluded_dates or [],
    }
    try:
        result = S.simulate(payload, _holiday_table(db))
    except Exception as e:
        raise HTTPException(400, f"시뮬레이션 계산 오류: {e}")
    return ApiResponse(success=True, data=result)


# ── 직원별 월간 인정시간 수동 조정 (저장형) ─────────────────────────────
class HoursBody(BaseModel):
    staff_id: str
    year: int
    month: int
    hours: float
    memo: Optional[str] = None


@router.get("/hours")
def list_hours(year: int = Query(...), month: int = Query(...),
               db: Session = Depends(get_db), _: User = Depends(_require)):
    return ApiResponse(success=True, data=_hour_overrides(db, year, month))


@router.put("/hours")
def upsert_hours(body: HoursBody, db: Session = Depends(get_db), _: User = Depends(_require)):
    if body.hours < 0:
        raise HTTPException(400, "근무시간은 0 이상이어야 합니다.")
    row = db.query(StaffMonthlyHours).filter(
        StaffMonthlyHours.staff_id == body.staff_id,
        StaffMonthlyHours.year == body.year,
        StaffMonthlyHours.month == body.month,
    ).first()
    if row:
        row.hours = body.hours
        if body.memo is not None:
            row.memo = body.memo or None
    else:
        db.add(StaffMonthlyHours(
            staff_id=body.staff_id, year=body.year, month=body.month,
            hours=body.hours, memo=(body.memo or None),
        ))
    db.commit()
    return ApiResponse(success=True, message="저장되었습니다.")


@router.delete("/hours/{staff_id}")
def delete_hours(staff_id: str, year: int = Query(...), month: int = Query(...),
                 db: Session = Depends(get_db), _: User = Depends(_require)):
    """조정값 삭제 → 자동 계산으로 복귀"""
    db.query(StaffMonthlyHours).filter(
        StaffMonthlyHours.staff_id == staff_id,
        StaffMonthlyHours.year == year,
        StaffMonthlyHours.month == month,
    ).delete(synchronize_session=False)
    db.commit()
    return ApiResponse(success=True, message="자동 계산으로 되돌렸습니다.")
