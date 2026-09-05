"""요양보호사 하루 — 앱을 열면 오늘 무엇을 하고 어느 어르신을 맡는지.

■ 무엇을 합쳐 보여주는가

  하나의 화면에 필요한 것이 네 군데에 흩어져 있다.
    · 오늘 무슨 근무인가        → 근무표 (WorkSchedule)
    · 그 근무의 일과            → 일과표 (CaregiverRoutine)
    · 오늘만의 일               → 그날 일정 (CaregiverDayTask)
    · 내가 맡은 어르신          → 담당 배정 (ResidentAssignment)

  앱에서 네 번 부르면 네 번 기다리고, 한 군데만 늦어도 화면이 반쯤 빈 채로
  뜬다. 그래서 /mine 한 번에 묶어 준다.

■ 층은 어떻게 정하는가

  요양보호사에게 층이 따로 저장돼 있지 않다. 대신 맡은 어르신이 어느 층에
  계신지는 안다. 그래서 담당 어르신이 가장 많은 층을 그 사람의 층으로 본다.
  담당이 아직 없으면 층 없이, 공통 일과만 보여준다 — 층을 잘못 찍어
  남의 층 일과를 띄우는 것보다 낫다.

■ 권한

  일과표를 정하는 것은 ADMIN·시설장까지. 보는 것은 로그인한 직원 전부다.
  본인 것만 보므로 남의 하루가 새지 않는다.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.assignment import ResidentAssignment
from app.models.caregiver_day import CaregiverDayTask, CaregiverRoutine
from app.models.eval import LtcResident, LtcStaffMember
from app.models.user import User
from app.models.work_schedule import WorkSchedule
from app.schemas.response import ApiResponse
from app.services.staff_link import resolve_staff_for_user
from app.core.security import get_current_user

router = APIRouter()

KST = timezone(timedelta(hours=9))
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

# 근무 코드 → 사람이 읽는 말. 근무표(shiftCodes.ts)와 같은 뜻이어야 한다.
SHIFT_LABEL = {
    "D": "주간", "M": "모닝", "AD": "오전", "PD": "오후", "N": "야간",
    "休": "연차", "대휴": "대체휴무", "초과휴": "초과 휴무", "◆병": "병가", "◆": "휴무",
}
# 일과표를 만들 수 있는 근무 — 쉬는 날에는 일과가 없다
WORK_CODES = ("D", "M", "AD", "PD", "N")


def today_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def _manager(current_user: User = Depends(get_current_user)) -> User:
    """일과표를 정하는 사람 — 관리자와 시설장."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "요양보호사 일정을 정할 권한이 없습니다. (관리자·시설장)")
    return current_user


# ── 일과표 ────────────────────────────────────────────────────────────────

class RoutineIn(BaseModel):
    shift_code: str
    floor: Optional[str] = None
    start_time: str
    end_time: Optional[str] = None
    title: str
    note: Optional[str] = None


class RoutinesBody(BaseModel):
    """통째로 저장한다 — 줄을 지웠는지 더했는지 화면이 따지지 않게."""
    items: List[RoutineIn]


def _routine_view(r: CaregiverRoutine) -> dict:
    return {
        "id": r.id, "shift_code": r.shift_code, "floor": r.floor,
        "start_time": r.start_time, "end_time": r.end_time,
        "title": r.title, "note": r.note, "sort": r.sort,
    }


def _clean_routines(items: List[RoutineIn]) -> List[RoutineIn]:
    """말이 되는 줄만 남긴다.

    시각이 'HH:MM' 이 아니면 버린다. 09:5 같은 것이 하나 섞이면 정렬이
    무너져 하루가 뒤죽박죽으로 보인다 — 틀린 순서는 빈 줄보다 나쁘다.
    """
    out: List[RoutineIn] = []
    for it in items:
        code = (it.shift_code or "").strip()
        title = (it.title or "").strip()
        start = (it.start_time or "").strip()
        if code not in WORK_CODES or not title or not _TIME.match(start):
            continue
        end = (it.end_time or "").strip()
        if end and not _TIME.match(end):
            end = ""
        out.append(RoutineIn(
            shift_code=code, floor=(it.floor or "").strip() or None,
            start_time=start, end_time=end or None,
            title=title[:80], note=((it.note or "").strip()[:200] or None),
        ))
    # 시각 순으로 저장해 둔다 — 읽는 쪽마다 다시 정렬하지 않게
    out.sort(key=lambda x: (x.shift_code, x.floor or "", x.start_time))
    return out


@router.get("/routines")
def list_routines(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """일과표 전체. 보는 것은 전 직원 — 남의 개인정보가 아니라 시설의 일과다."""
    rows = (db.query(CaregiverRoutine)
            .filter(CaregiverRoutine.active.is_(True))
            .order_by(CaregiverRoutine.shift_code, CaregiverRoutine.start_time).all())
    return ApiResponse(success=True, data={
        "items": [_routine_view(r) for r in rows],
        "shift_codes": [{"code": c, "label": SHIFT_LABEL.get(c, c)} for c in WORK_CODES],
    })


@router.put("/routines")
def save_routines(body: RoutinesBody, db: Session = Depends(get_db),
                  _: User = Depends(_manager)):
    """통째로 바꾼다.

    한 줄씩 고치는 API 를 두면 화면이 '무엇을 지웠는지' 를 기억해야 하고,
    그 기억이 틀리면 지운 줄이 되살아난다. 통째로 보내면 화면에 보이는
    것이 곧 저장된 것이다.
    """
    items = _clean_routines(body.items)
    db.query(CaregiverRoutine).delete()
    for i, it in enumerate(items):
        db.add(CaregiverRoutine(
            shift_code=it.shift_code, floor=it.floor,
            start_time=it.start_time, end_time=it.end_time,
            title=it.title, note=it.note, sort=i, active=True,
        ))
    db.commit()
    return ApiResponse(success=True, data={"count": len(items)})


# ── 그날만의 일정 ─────────────────────────────────────────────────────────

class DayTaskIn(BaseModel):
    date: str
    staff_id: Optional[str] = None
    floor: Optional[str] = None
    start_time: Optional[str] = None
    title: str
    note: Optional[str] = None


def _task_view(t: CaregiverDayTask) -> dict:
    return {
        "id": t.id, "date": t.date, "staff_id": t.staff_id, "staff_name": t.staff_name,
        "floor": t.floor, "start_time": t.start_time, "title": t.title, "note": t.note,
        "created_by": t.created_by,
    }


@router.get("/day")
def list_day(date: str = Query(...), db: Session = Depends(get_db),
             _: User = Depends(_manager)):
    if not _DATE.match(date or ""):
        raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 여야 합니다.")
    rows = (db.query(CaregiverDayTask).filter(CaregiverDayTask.date == date)
            .order_by(CaregiverDayTask.start_time.nullslast(), CaregiverDayTask.created_at).all())
    return ApiResponse(success=True, data=[_task_view(t) for t in rows])


@router.post("/day")
def add_day(body: DayTaskIn, db: Session = Depends(get_db),
            current_user: User = Depends(_manager)):
    if not _DATE.match(body.date or ""):
        raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 여야 합니다.")
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "할 일을 적어주세요.")
    start = (body.start_time or "").strip()
    if start and not _TIME.match(start):
        raise HTTPException(400, "시각 형식은 HH:MM 이어야 합니다.")
    name = None
    if body.staff_id:
        s = db.query(LtcStaffMember).filter(LtcStaffMember.id == body.staff_id).first()
        if not s:
            raise HTTPException(404, "그 직원을 찾을 수 없습니다.")
        name = s.name
    t = CaregiverDayTask(
        date=body.date, staff_id=body.staff_id or None, staff_name=name,
        floor=(body.floor or "").strip() or None, start_time=start or None,
        title=title[:80], note=((body.note or "").strip()[:200] or None),
        created_by=getattr(current_user, "name", None),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return ApiResponse(success=True, data=_task_view(t))


@router.delete("/day/{task_id}")
def remove_day(task_id: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    t = db.query(CaregiverDayTask).filter(CaregiverDayTask.id == task_id).first()
    if not t:
        raise HTTPException(404, "그 일정을 찾을 수 없습니다.")
    db.delete(t)
    db.commit()
    return ApiResponse(success=True, data={"deleted": task_id})


# ── 내 하루 ───────────────────────────────────────────────────────────────

def _my_residents(db: Session, staff_id: str) -> List[dict]:
    """내가 담당인 어르신 — 층·호실 순서로. 종이 명단과 같은 차례여야 한다."""
    asg = (db.query(ResidentAssignment)
           .filter(ResidentAssignment.care_staff_id == staff_id).all())
    if not asg:
        return []
    ids = [a.resident_id for a in asg]
    notes = {a.resident_id: a.note for a in asg}
    residents = (db.query(LtcResident)
                 .filter(LtcResident.id.in_(ids))
                 .filter(LtcResident.status.in_(["active", "pending"])).all())
    rows = [{
        "id": r.id, "name": r.name,
        "floor": r.floor or "미지정", "room": r.room or "",
        "note": notes.get(r.id),
    } for r in residents]
    rows.sort(key=lambda x: (x["floor"], x["room"] or "999", x["name"]))
    return rows


@router.get("/mine")
def my_day(date: Optional[str] = Query(None), db: Session = Depends(get_db),
           current_user: User = Depends(get_current_user)):
    """오늘 내 하루 — 근무 · 일과 · 오늘만의 일 · 담당 어르신을 한 번에.

    직원 명단에 연결되지 않은 계정이면 빈 하루를 돌려준다. 여기서 404 를
    내면 대시보드 전체가 빨간 오류로 덮인다 — 이 카드 하나 때문에 다른
    것까지 못 보게 할 일은 아니다.
    """
    d = (date or "").strip() or today_kst()
    if not _DATE.match(d):
        raise HTTPException(400, "날짜 형식은 YYYY-MM-DD 여야 합니다.")

    empty = {"date": d, "staff_name": getattr(current_user, "name", None),
             "linked": False, "shift_code": None, "shift_label": None,
             "floor": None, "items": [], "residents": []}
    try:
        staff = resolve_staff_for_user(db, current_user)
    except HTTPException:
        return ApiResponse(success=True, data=empty)

    # 오늘 무슨 근무인가 — 근무표에서
    month, day = d[:7], str(int(d[8:10]))
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    code = ((w.data or {}).get(staff.id, {}) if w else {}).get(day) or None
    code = (code or "").strip() or None

    residents = _my_residents(db, staff.id)
    # 층은 담당 어르신이 가장 많은 곳으로 본다 (요양보호사에게 층이 따로 없다)
    floors = Counter(r["floor"] for r in residents if r["floor"] != "미지정")
    floor = floors.most_common(1)[0][0] if floors else None

    items: List[dict] = []
    if code in WORK_CODES:
        rows = (db.query(CaregiverRoutine)
                .filter(CaregiverRoutine.active.is_(True))
                .filter(CaregiverRoutine.shift_code == code).all())
        for r in rows:
            # 층이 지정된 줄은 그 층 사람에게만. 층을 모르면 공통만 보여준다.
            if r.floor and r.floor != floor:
                continue
            items.append({"time": r.start_time, "end": r.end_time, "title": r.title,
                          "note": r.note, "kind": "routine", "floor": r.floor})

    # 오늘만의 일 — 나에게 / 내 층에 / 전체에 걸린 것
    for t in db.query(CaregiverDayTask).filter(CaregiverDayTask.date == d).all():
        if t.staff_id and t.staff_id != staff.id:
            continue
        if not t.staff_id and t.floor and t.floor != floor:
            continue
        items.append({"time": t.start_time, "end": None, "title": t.title,
                      "note": t.note, "kind": "extra", "floor": t.floor})

    # 시각 순. 시각이 없는 것은 맨 뒤 — 언제든 하면 되는 일이다.
    items.sort(key=lambda x: (x["time"] is None, x["time"] or ""))

    return ApiResponse(success=True, data={
        "date": d, "staff_name": staff.name, "linked": True,
        # 모르는 코드는 코드를 그대로 이름으로 쓴다. '0930 1230' 처럼 직접 적은
        # 시간대도 엄연히 근무다 — 이름을 못 붙인다고 쉬는 날로 보이면 안 된다.
        "shift_code": code, "shift_label": (SHIFT_LABEL.get(code) or code) if code else None,
        "floor": floor, "items": items, "residents": residents,
    })
