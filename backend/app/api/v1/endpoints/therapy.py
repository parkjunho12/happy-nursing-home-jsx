"""치료 프로그램 조 편성 API.

조를 만들고, 어르신을 넣고, 시간표를 짠다. 방송·알림은 이 시간표를 읽어
간다(therapy_broadcast).

권한: 조를 짜는 것은 프로그램을 굴리는 사람들의 일이다. ADMIN·시설장·
사회복지사·작업치료사·물리치료사가 고칠 수 있고, 나머지는 볼 수만 있다.
근무 중인 선생님이 '지금 몇 시에 누구를 보는지' 는 봐야 하기 때문이다.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcResident
from app.models.therapy import (
    TherapyGroup, TherapyGroupMember, TherapySlot, KINDS, KIND_GATHER, now_kst,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# 조를 고칠 수 있는 사람들
EDIT_POSITIONS = {"시설장", "사회복지사", "작업치료사", "물리치료사", "대표", "이사"}

TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def _role(u: User) -> str:
    return u.role.value if hasattr(u.role, "value") else str(u.role)


def _can_edit(u: User = Depends(get_current_user)) -> User:
    if _role(u) == "ADMIN" or (u.position or "") in EDIT_POSITIONS:
        return u
    raise HTTPException(403, "조 편성은 시설장·사회복지사·치료사만 고칠 수 있습니다.")


def _check_time(v: Optional[str], field: str) -> Optional[str]:
    if v in (None, ""):
        return None
    if not TIME_RE.match(v):
        raise HTTPException(400, f"{field} 시각 형식이 올바르지 않습니다 (HH:MM).")
    return v


def _group_view(g: TherapyGroup, members: List[dict]) -> dict:
    return {
        "id": g.id, "name": g.name, "floor": g.floor, "kind": g.kind,
        "note": g.note, "color": g.color, "sort": g.sort, "active": bool(g.active),
        "members": members, "count": len(members),
    }


def _slot_view(s: TherapySlot) -> dict:
    return {
        "id": s.id, "weekday": s.weekday, "start_time": s.start_time,
        "end_time": s.end_time, "group_id": s.group_id, "place": s.place,
        "activity": s.activity, "broadcast": bool(s.broadcast),
        "notify": bool(s.notify), "lead_min": s.lead_min, "active": bool(s.active),
    }


@router.get("")
def overview(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """조·조원·시간표를 한 번에. 화면이 한 번만 부르면 되게."""
    groups = (db.query(TherapyGroup)
                .order_by(TherapyGroup.sort, TherapyGroup.name).all())
    mems = db.query(TherapyGroupMember).order_by(TherapyGroupMember.sort).all()

    rids = [m.resident_id for m in mems]
    rmap: Dict[str, LtcResident] = {}
    if rids:
        for r in db.query(LtcResident).filter(LtcResident.id.in_(rids)).all():
            rmap[r.id] = r

    by_group: Dict[str, List[dict]] = {}
    for m in mems:
        r = rmap.get(m.resident_id)
        if not r:
            continue          # 지워진 어르신 — 명단에 유령을 남기지 않는다
        by_group.setdefault(m.group_id, []).append({
            "resident_id": r.id, "name": r.name, "floor": r.floor,
            "room": r.room, "status": r.status,
        })

    # 아직 어느 조에도 안 들어간 분 — 편성에서 빠진 사람이 보여야 한다
    taken = set(rids)
    unassigned = [
        {"resident_id": r.id, "name": r.name, "floor": r.floor, "room": r.room}
        for r in (db.query(LtcResident)
                    .filter(LtcResident.status == "active")
                    .order_by(LtcResident.floor, LtcResident.room, LtcResident.name).all())
        if r.id not in taken
    ]

    slots = (db.query(TherapySlot)
               .order_by(TherapySlot.weekday, TherapySlot.start_time).all())

    return ApiResponse(success=True, data={
        "groups": [_group_view(g, by_group.get(g.id, [])) for g in groups],
        "unassigned": unassigned,
        "slots": [_slot_view(s) for s in slots],
    })


class GroupBody(BaseModel):
    name: str
    floor: Optional[str] = None
    kind: str = KIND_GATHER
    note: Optional[str] = None
    color: Optional[str] = None
    sort: Optional[int] = None
    active: Optional[bool] = None


@router.post("/groups")
def create_group(body: GroupBody, db: Session = Depends(get_db),
                 _: User = Depends(_can_edit)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "조 이름을 적어주세요.")
    if body.kind not in KINDS:
        raise HTTPException(400, "알 수 없는 조 성격입니다.")
    last = db.query(TherapyGroup).order_by(TherapyGroup.sort.desc()).first()
    g = TherapyGroup(name=name[:40], floor=body.floor, kind=body.kind,
                     note=body.note, color=body.color,
                     sort=body.sort if body.sort is not None else ((last.sort + 1) if last else 0),
                     active=True if body.active is None else bool(body.active))
    db.add(g); db.commit(); db.refresh(g)
    return ApiResponse(success=True, data=_group_view(g, []), message="조를 만들었습니다.")


@router.patch("/groups/{gid}")
def update_group(gid: str, body: GroupBody, db: Session = Depends(get_db),
                 _: User = Depends(_can_edit)):
    g = db.query(TherapyGroup).filter(TherapyGroup.id == gid).first()
    if not g:
        raise HTTPException(404, "조를 찾을 수 없습니다.")
    if body.kind and body.kind not in KINDS:
        raise HTTPException(400, "알 수 없는 조 성격입니다.")
    if body.name is not None and body.name.strip():
        g.name = body.name.strip()[:40]
    for f in ("floor", "kind", "note", "color"):
        v = getattr(body, f)
        if v is not None:
            setattr(g, f, v)
    if body.sort is not None:
        g.sort = body.sort
    if body.active is not None:
        g.active = bool(body.active)
    g.updated_at = now_kst()
    db.commit(); db.refresh(g)
    return ApiResponse(success=True, data={"id": g.id}, message="저장했습니다.")


@router.delete("/groups/{gid}")
def delete_group(gid: str, db: Session = Depends(get_db), _: User = Depends(_can_edit)):
    """조를 지운다 — 어르신은 지우지 않고 연결만 끊는다.

    시간표에 이 조가 걸려 있으면 막는다. 조 없는 시간표가 남으면 그 시간에
    아무도 안 불리는데 표에는 있는 상태가 된다.
    """
    g = db.query(TherapyGroup).filter(TherapyGroup.id == gid).first()
    if not g:
        raise HTTPException(404, "조를 찾을 수 없습니다.")
    used = db.query(TherapySlot).filter(TherapySlot.group_id == gid).count()
    if used:
        raise HTTPException(400, f"시간표에 {used}칸 걸려 있습니다. 시간표에서 먼저 빼주세요.")
    db.query(TherapyGroupMember).filter(TherapyGroupMember.group_id == gid).delete()
    db.delete(g); db.commit()
    return ApiResponse(success=True, data={"id": gid}, message="조를 지웠습니다.")


class MembersBody(BaseModel):
    resident_ids: List[str]


@router.put("/groups/{gid}/members")
def set_members(gid: str, body: MembersBody, db: Session = Depends(get_db),
                _: User = Depends(_can_edit)):
    """이 조의 명단을 통째로 바꾼다.

    한 분이 두 조에 들어가면 같은 시간에 두 곳에서 이름을 부르게 된다.
    그래서 다른 조에 있던 분을 넣으면 그쪽에서 빼 온다 — 막고 오류를 내면
    '어느 조에 있는지 찾아서 먼저 빼세요' 를 사람이 하게 되고, 그건 화면이
    할 일이다.
    """
    g = db.query(TherapyGroup).filter(TherapyGroup.id == gid).first()
    if not g:
        raise HTTPException(404, "조를 찾을 수 없습니다.")

    ids = [i for i in dict.fromkeys(body.resident_ids or []) if i]
    if ids:
        found = {r.id for r in db.query(LtcResident.id).filter(LtcResident.id.in_(ids)).all()}
        missing = [i for i in ids if i not in found]
        if missing:
            raise HTTPException(400, "명단에 없는 어르신이 있습니다.")

    # 이 조의 기존 명단을 비우고
    db.query(TherapyGroupMember).filter(TherapyGroupMember.group_id == gid).delete()
    # 다른 조에 있던 분은 그쪽에서 빼 온다
    moved = 0
    if ids:
        q = (db.query(TherapyGroupMember)
               .filter(TherapyGroupMember.resident_id.in_(ids)))
        moved = q.count()
        q.delete(synchronize_session=False)
    db.flush()

    for i, rid in enumerate(ids):
        db.add(TherapyGroupMember(group_id=gid, resident_id=rid, sort=i))
    db.commit()
    msg = f"{len(ids)}분을 편성했습니다."
    if moved:
        msg += f" (다른 조에 있던 {moved}분을 옮겨왔습니다)"
    return ApiResponse(success=True, data={"group_id": gid, "count": len(ids)}, message=msg)


class SlotBody(BaseModel):
    weekday: int
    start_time: str
    end_time: Optional[str] = None
    group_id: str
    place: Optional[str] = None
    activity: Optional[str] = None
    broadcast: Optional[bool] = None
    notify: Optional[bool] = None
    lead_min: Optional[int] = None
    active: Optional[bool] = None


def _apply_slot(s: TherapySlot, body: SlotBody, db: Session) -> None:
    if body.weekday is not None:
        if not 0 <= int(body.weekday) <= 6:
            raise HTTPException(400, "요일이 올바르지 않습니다.")
        s.weekday = int(body.weekday)
    if body.start_time is not None:
        s.start_time = _check_time(body.start_time, "시작") or s.start_time
    if body.end_time is not None:
        s.end_time = _check_time(body.end_time, "종료")
    if body.group_id:
        if not db.query(TherapyGroup).filter(TherapyGroup.id == body.group_id).first():
            raise HTTPException(400, "조를 찾을 수 없습니다.")
        s.group_id = body.group_id
    for f in ("place", "activity"):
        v = getattr(body, f)
        if v is not None:
            setattr(s, f, v)
    for f in ("broadcast", "notify", "active"):
        v = getattr(body, f)
        if v is not None:
            setattr(s, f, bool(v))
    if body.lead_min is not None:
        s.lead_min = max(0, min(60, int(body.lead_min)))
    if s.end_time and s.end_time <= s.start_time:
        raise HTTPException(400, "종료 시각이 시작보다 빠릅니다.")


@router.post("/slots")
def create_slot(body: SlotBody, db: Session = Depends(get_db), _: User = Depends(_can_edit)):
    s = TherapySlot(weekday=0, start_time="09:00", group_id=body.group_id)
    _apply_slot(s, body, db)
    db.add(s); db.commit(); db.refresh(s)
    return ApiResponse(success=True, data=_slot_view(s), message="시간표에 넣었습니다.")


@router.patch("/slots/{sid}")
def update_slot(sid: str, body: SlotBody, db: Session = Depends(get_db),
                _: User = Depends(_can_edit)):
    s = db.query(TherapySlot).filter(TherapySlot.id == sid).first()
    if not s:
        raise HTTPException(404, "시간표를 찾을 수 없습니다.")
    _apply_slot(s, body, db)
    s.updated_at = now_kst()
    db.commit(); db.refresh(s)
    return ApiResponse(success=True, data=_slot_view(s), message="저장했습니다.")


@router.delete("/slots/{sid}")
def delete_slot(sid: str, db: Session = Depends(get_db), _: User = Depends(_can_edit)):
    s = db.query(TherapySlot).filter(TherapySlot.id == sid).first()
    if not s:
        raise HTTPException(404, "시간표를 찾을 수 없습니다.")
    db.delete(s); db.commit()
    return ApiResponse(success=True, data={"id": sid}, message="지웠습니다.")
