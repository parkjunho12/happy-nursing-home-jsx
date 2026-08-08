"""담당 어르신 배정 API.

- 명단: 재원 어르신 + 배정 + 호실을 층별로
- 자동 배정: 담당이 빈 어르신을 '가장 적게 맡은' 직원에게 — 기존 배정은 안 건드린다
- 모든 변경은 로그로 남는다 (누가·언제·무엇을)
권한: ADMIN · 시설장 · 사회복지사
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.assignment import ResidentAssignment, ResidentAssignmentLog
from app.models.eval import LtcResident, LtcStaffMember
from app.schemas.response import ApiResponse

router = APIRouter()

CARE_POSITIONS = ("요양보호사",)                 # 담당 요양팀 후보
REHAB_POSITIONS = ("물리치료사",)                # 담당 재활팀 = 물리치료사


def _editor(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "사회복지사", "대표", "이사", "간호팀장", "간호사", "간호조무사"):
        raise HTTPException(403, "담당 배정 권한이 없습니다. (관리자·시설장·사회복지사·대표·이사)")
    return current_user


def _log(db: Session, r: LtcResident, field: str, before: Optional[str],
         after: Optional[str], who: Optional[str]):
    if (before or "") == (after or ""):
        return
    db.add(ResidentAssignmentLog(resident_id=r.id, resident_name=r.name,
                                 field=field, before=before, after=after, changed_by=who))


@router.get("")
def roster(db: Session = Depends(get_db), _: User = Depends(_editor)):
    """층·호실별 명단 + 배정 + 담당별 집계."""
    residents = (db.query(LtcResident)
                 .filter(LtcResident.status.in_(["active", "pending"])).all())   # 예정자 포함
    asg = {a.resident_id: a for a in db.query(ResidentAssignment).all()}
    rows = []
    for r in residents:
        a = asg.get(r.id)
        rows.append({
            "resident_id": r.id, "name": r.name,
            "floor": r.floor or "미지정", "room": r.room or "",
            "admission_date": r.admission_date,
            "care_staff_id": a.care_staff_id if a else None,
            "care_staff_name": a.care_staff_name if a else None,
            "rehab_staff_id": a.rehab_staff_id if a else None,
            "rehab_staff_name": a.rehab_staff_name if a else None,
            "note": a.note if a else None,
        })
    rows.sort(key=lambda x: (x["floor"], x["room"] or "999", x["name"]))

    # 입사 예정자도 포함 — 새로 오실 선생님을 미리 배정해둘 수 있게
    staff = db.query(LtcStaffMember).filter(LtcStaffMember.status.in_(["active", "pending"])).all()
    care = [{"id": s.id, "name": s.name, "pending": s.status == "pending", "hire_date": s.hire_date}
            for s in staff if (s.position or "") in CARE_POSITIONS]
    rehab = [{"id": s.id, "name": s.name, "pending": s.status == "pending", "hire_date": s.hire_date}
             for s in staff if (s.position or "") in REHAB_POSITIONS]
    return ApiResponse(success=True, data={"rows": rows, "care_staff": care, "rehab_staff": rehab})


class AssignBody(BaseModel):
    care_staff_id: Optional[str] = None
    rehab_staff_id: Optional[str] = None
    note: Optional[str] = None
    room: Optional[str] = None
    # 어떤 필드를 보냈는지 구분하기 위한 플래그 (null=해제도 가능해야 해서)
    set_care: Optional[bool] = None
    set_rehab: Optional[bool] = None
    set_note: Optional[bool] = None
    set_room: Optional[bool] = None


def _staff_name(db: Session, sid: Optional[str]) -> Optional[str]:
    if not sid:
        return None
    st = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    return st.name if st else None


@router.put("/{resident_id}")
def assign(resident_id: str, body: AssignBody, db: Session = Depends(get_db),
           current_user: User = Depends(_editor)):
    r = db.query(LtcResident).filter(LtcResident.id == resident_id).first()
    if not r:
        raise HTTPException(404, "어르신을 찾을 수 없습니다.")
    a = db.query(ResidentAssignment).filter(
        ResidentAssignment.resident_id == resident_id).first()
    if not a:
        a = ResidentAssignment(resident_id=resident_id)
        db.add(a)
    who = getattr(current_user, "name", None)

    if body.set_care:
        name = _staff_name(db, body.care_staff_id)
        _log(db, r, "요양팀", a.care_staff_name, name, who)
        a.care_staff_id, a.care_staff_name = body.care_staff_id, name
    if body.set_rehab:
        name = _staff_name(db, body.rehab_staff_id)
        _log(db, r, "재활팀", a.rehab_staff_name, name, who)
        a.rehab_staff_id, a.rehab_staff_name = body.rehab_staff_id, name
    if body.set_note:
        _log(db, r, "기타", a.note, body.note, who)
        a.note = (body.note or "").strip() or None
    if body.set_room:
        _log(db, r, "호실", r.room, body.room, who)
        r.room = (body.room or "").strip() or None
    a.updated_by = who
    db.commit()
    return ApiResponse(success=True, message="저장했습니다.")


@router.post("/auto")
def auto_assign(kind: str = Query(..., description="care | rehab"),
                db: Session = Depends(get_db), current_user: User = Depends(_editor)):
    """자동 배정 — 담당이 빈 어르신을 가장 적게 맡은 직원에게 차례로.

    이미 배정된 어르신은 절대 건드리지 않는다(관계는 함부로 바꾸는 게 아니다).
    전면 재배정이 필요하면 배정을 비우고 다시 돌리면 된다."""
    if kind not in ("care", "rehab"):
        raise HTTPException(400, "kind는 care 또는 rehab.")
    positions = CARE_POSITIONS if kind == "care" else REHAB_POSITIONS
    staff = [s for s in db.query(LtcStaffMember)
             .filter(LtcStaffMember.status == "active").all()
             if (s.position or "") in positions]
    if not staff:
        raise HTTPException(400, "배정할 직원이 없습니다. (직종을 확인해주세요)")

    residents = db.query(LtcResident).filter(LtcResident.status == "active").all()
    asg = {a.resident_id: a for a in db.query(ResidentAssignment).all()}

    # 현재 담당 수 세기
    load = {s.id: 0 for s in staff}
    for a in asg.values():
        sid = a.care_staff_id if kind == "care" else a.rehab_staff_id
        if sid in load:
            load[sid] += 1

    # ── 입소일 근무자 우선 — 첫날 어르신을 맞이한(할) 선생님이 담당이 되는 게 자연스럽다 ──
    from app.models.work_schedule import WorkSchedule
    NON_WORK = {"休", "대휴", "초과휴", "◆", "◆병"}
    _sched_cache: dict = {}
    def _worked_on(staff_id: str, date: str) -> bool:
        if not date or len(date) < 10:
            return False
        ym = date[:7]
        if ym not in _sched_cache:
            w = db.query(WorkSchedule).filter(WorkSchedule.year_month == ym).first()
            _sched_cache[ym] = (w.data if w else None) or {}
        code = (_sched_cache[ym].get(staff_id) or {}).get(str(int(date[8:10])))
        c = (code or "").strip()
        return bool(c) and c not in NON_WORK

    who = getattr(current_user, "name", None)
    made = 0
    # 호실 순으로 — 같은 방 어르신이 가급적 이어지게
    for r in sorted(residents, key=lambda x: (x.floor or "", x.room or "999", x.name)):
        a = asg.get(r.id)
        cur = (a.care_staff_id if kind == "care" else a.rehab_staff_id) if a else None
        if cur:
            continue
        # 입소일에 근무한(할) 후보가 있으면 그 안에서, 없으면 전체에서 — 둘 다 최소 담당 우선
        adm = (r.admission_date or "")[:10]
        on_day = [s for s in staff if _worked_on(s.id, adm)]
        pool = on_day or staff
        target = min(pool, key=lambda s: load[s.id])
        if not a:
            a = ResidentAssignment(resident_id=r.id)
            db.add(a); asg[r.id] = a
        if kind == "care":
            _log(db, r, "요양팀", a.care_staff_name, target.name, f"{who}(자동)")
            a.care_staff_id, a.care_staff_name = target.id, target.name
        else:
            _log(db, r, "재활팀", a.rehab_staff_name, target.name, f"{who}(자동)")
            a.rehab_staff_id, a.rehab_staff_name = target.id, target.name
        a.updated_by = who
        load[target.id] += 1
        made += 1
    db.commit()
    return ApiResponse(success=True, data={
        "assigned": made,
        "load": [{"name": s.name, "count": load[s.id]} for s in
                 sorted(staff, key=lambda x: x.name)],
    })


@router.get("/logs")
def logs(limit: int = Query(50), db: Session = Depends(get_db), _: User = Depends(_editor)):
    rows = (db.query(ResidentAssignmentLog)
            .order_by(ResidentAssignmentLog.created_at.desc())
            .limit(max(1, min(limit, 200))).all())
    return ApiResponse(success=True, data=[{
        "id": l.id, "resident_name": l.resident_name, "field": l.field,
        "before": l.before, "after": l.after, "changed_by": l.changed_by,
        "at": l.created_at.isoformat() if l.created_at else None,
    } for l in rows])
