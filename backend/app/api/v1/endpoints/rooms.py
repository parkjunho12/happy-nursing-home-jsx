"""층·호실 API — 설정 CRUD + 점유 현황(침대 그림용).

- 설정(추가·수정·삭제): ADMIN·시설장
- 점유 현황 조회: 어르신 등록하는 사람 전부 (사회복지사 포함)
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.room import RoomConfig
from app.models.eval import LtcResident
from app.schemas.response import ApiResponse

router = APIRouter()


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN" and (getattr(current_user, "position", None) or "") != "시설장":
        raise HTTPException(403, "층·호실 설정 권한이 없습니다. (관리자·시설장)")
    return current_user


@router.get("/occupancy")
def occupancy(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """층 → 호실 → 침대 현황. 어르신 등록 화면의 침대 그림이 이걸 그린다."""
    configs = (db.query(RoomConfig).filter(RoomConfig.active == True)  # noqa: E712
               .order_by(RoomConfig.floor, RoomConfig.order, RoomConfig.room).all())
    residents = db.query(LtcResident).filter(LtcResident.status == "active").all()
    by_room: dict = {}
    for r in residents:
        if r.room:
            by_room.setdefault((r.floor or "", r.room), []).append(r.name)

    floors: dict = {}
    for c in configs:
        occupants = by_room.get((c.floor, c.room), [])
        floors.setdefault(c.floor, []).append({
            "id": c.id, "room": c.room, "capacity": c.capacity or 4,
            "occupants": occupants, "free": max(0, (c.capacity or 4) - len(occupants)),
        })
    return ApiResponse(success=True, data={
        "floors": [{
            "floor": f,
            "rooms": rooms,
            "capacity": sum(r["capacity"] for r in rooms),
            "occupied": sum(len(r["occupants"]) for r in rooms),
        } for f, rooms in floors.items()],
    })


class RoomBody(BaseModel):
    floor: str
    room: str
    capacity: int = 4
    order: Optional[int] = None


@router.get("")
def list_rooms(db: Session = Depends(get_db), _: User = Depends(_manager)):
    rows = (db.query(RoomConfig).filter(RoomConfig.active == True)  # noqa: E712
            .order_by(RoomConfig.floor, RoomConfig.order, RoomConfig.room).all())
    return ApiResponse(success=True, data=[{
        "id": r.id, "floor": r.floor, "room": r.room, "capacity": r.capacity or 4,
    } for r in rows])


@router.post("")
def create_room(body: RoomBody, db: Session = Depends(get_db), _: User = Depends(_manager)):
    floor, room = body.floor.strip(), body.room.strip()
    if not floor or not room:
        raise HTTPException(400, "층과 호실명을 입력해주세요.")
    dup = db.query(RoomConfig).filter(RoomConfig.floor == floor, RoomConfig.room == room,
                                      RoomConfig.active == True).first()  # noqa: E712
    if dup:
        raise HTTPException(409, f"{floor} {room}호는 이미 있습니다.")
    if not (1 <= body.capacity <= 12):
        raise HTTPException(400, "정원은 1~12명 사이여야 합니다.")
    r = RoomConfig(floor=floor, room=room, capacity=body.capacity, order=body.order or 0)
    db.add(r); db.commit()
    return ApiResponse(success=True, data={"id": r.id})


@router.put("/{rid}")
def update_room(rid: str, body: RoomBody, db: Session = Depends(get_db), _: User = Depends(_manager)):
    r = db.query(RoomConfig).filter(RoomConfig.id == rid).first()
    if not r:
        raise HTTPException(404, "호실을 찾을 수 없습니다.")
    if not (1 <= body.capacity <= 12):
        raise HTTPException(400, "정원은 1~12명 사이여야 합니다.")
    r.floor, r.room, r.capacity = body.floor.strip(), body.room.strip(), body.capacity
    if body.order is not None:
        r.order = body.order
    db.commit()
    return ApiResponse(success=True, message="저장했습니다.")


@router.delete("/{rid}")
def delete_room(rid: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    r = db.query(RoomConfig).filter(RoomConfig.id == rid).first()
    if not r:
        raise HTTPException(404, "호실을 찾을 수 없습니다.")
    r.active = False                       # 이력 보존을 위해 소프트 삭제
    db.commit()
    return ApiResponse(success=True, message="삭제했습니다.")
