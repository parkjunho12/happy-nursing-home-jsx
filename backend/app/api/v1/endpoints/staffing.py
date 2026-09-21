"""
요양보호사 인력배치 및 입소 가능성 시뮬레이터 API.
권한: ADMIN · 시설장
"""
from __future__ import annotations
import calendar
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
from app.models.work_schedule import WorkSchedule, WorkScheduleConfig
from app.schemas.response import ApiResponse
from app.services import staffing as S
from app.services import shift_hours as SH

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


def _actual_schedule_hours(db: Session, year: Optional[int], month: Optional[int]) -> dict:
    """그 달 실제 근무표(확정된 근무 코드)에서 직원별 총 근무시간을 뽑는다.

    근무표가 아직 없으면(미래 달이라 아직 편성 전) 빈 dict를 돌려준다 —
    호출부의 worker_expected_hours 가 그때는 재직일수 비례 추정치를 쓴다.
    엑셀 내보내기(work_schedule.py)와 같은 계산(shift_hours.month_total)을
    쓴다 — 근무표·인력배치 시뮬레이터·급여가 서로 다른 숫자를 말하면 안 된다.
    """
    if not year or not month:
        return {}
    ym = f"{year:04d}-{month:02d}"
    ws = db.query(WorkSchedule).filter(WorkSchedule.year_month == ym).first()
    if not ws or not ws.data:
        return {}
    cfg = db.query(WorkScheduleConfig).first()
    code_hours = SH.resolve_for_month(
        ym, (cfg.code_hours if cfg else None) or {}, (cfg.code_hours_rules if cfg else None) or [],
        (cfg.code_hours_months if cfg else None) or {})
    days = range(1, calendar.monthrange(year, month)[1] + 1)
    return {sid: SH.month_total(codes, days, code_hours) for sid, codes in (ws.data or {}).items()}


def _current_caregivers(db: Session, year: Optional[int] = None, month: Optional[int] = None) -> list:
    sched = _actual_schedule_hours(db, year, month)
    out = []
    seen_ids = set()
    for s in db.query(LtcStaffMember).filter(LtcStaffMember.status == "active").all():
        if not _is_caregiver(s.position):
            continue
        seen_ids.add(s.id)
        w = {"employee_id": s.id, "name": s.name, "hire_date": s.hire_date,
             "resign_date": s.resign_date, "is_expected_hire": False,
             "position": s.position, "leaves": s.leaves or []}
        if s.id in sched:
            w["schedule_hours"] = sched[s.id]
        out.append(w)

    # 그 달 안에 퇴사했어도 실제로 그 달 근무표에서 일한 시간이 있으면
    # 인정한다. 재직 상태만 보면 월중 퇴사자의 근무시간이 통째로 빠져,
    # 실제로 일한 시간보다 그 달 확보 인력이 적게 잡힌다.
    resigned_ids = set(sched.keys()) - seen_ids
    if resigned_ids:
        for s in db.query(LtcStaffMember).filter(LtcStaffMember.id.in_(resigned_ids)).all():
            hours = sched.get(s.id, 0)
            if not _is_caregiver(s.position) or hours <= 0:
                continue
            out.append({"employee_id": s.id, "name": s.name, "hire_date": s.hire_date,
                        "resign_date": s.resign_date, "is_expected_hire": False,
                        "position": s.position, "leaves": s.leaves or [],
                        "schedule_hours": hours})
    return out


@router.get("/context")
def context(year: Optional[int] = Query(None), month: Optional[int] = Query(None),
            db: Session = Depends(get_db), _: User = Depends(_require)):
    today = date.today()
    y = year or today.year
    m = month or today.month
    residents = [r for r in _current_residents(db) if r["status"] == "active"]
    workers = _current_caregivers(db, y, m)
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
        workers = _apply_overrides(_current_caregivers(db, body.year, body.month),
                                   _hour_overrides(db, body.year, body.month))

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
