"""근무표 API — 읽기·쓰기 모두 ADMIN·시설장 전용"""
from __future__ import annotations
import re
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.work_schedule import WorkSchedule
from app.schemas.response import ApiResponse

router = APIRouter()
_YM = re.compile(r"^\d{4}-\d{2}$")


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "근무표 접근 권한이 없습니다. (관리자·시설장)")
    return current_user


def _view(w: Optional[WorkSchedule], ym: str) -> dict:
    return {
        "year_month": ym,
        "data": (w.data if w and w.data else {}),
        "updated_by": (w.updated_by if w else None),
        "updated_at": (w.updated_at.isoformat() if w and w.updated_at else None),
    }


class ScheduleBody(BaseModel):
    year_month: str
    data: Dict[str, Any] = {}


@router.get("")
def get_schedule(month: str = Query(...), db: Session = Depends(get_db), _: User = Depends(_manager)):
    if not _YM.match(month or ""):
        raise HTTPException(400, "month 형식은 YYYY-MM 이어야 합니다.")
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    return ApiResponse(success=True, data=_view(w, month))


@router.put("")
def save_schedule(body: ScheduleBody, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    if not _YM.match(body.year_month or ""):
        raise HTTPException(400, "year_month 형식은 YYYY-MM 이어야 합니다.")
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == body.year_month).first()
    if not w:
        w = WorkSchedule(year_month=body.year_month)
        db.add(w)
    w.data = body.data or {}
    w.updated_by = getattr(current_user, "name", None)
    db.commit(); db.refresh(w)
    return ApiResponse(success=True, data=_view(w, body.year_month))
