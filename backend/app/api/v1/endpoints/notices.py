"""내부 공지사항 (직원용) — 읽기: 전 직원 / 쓰기: ADMIN · 시설장"""
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staffing import InternalNotice
from app.schemas.response import ApiResponse

router = APIRouter()
LEVELS = ("info", "important", "urgent")


def _can_write(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "공지 작성 권한이 없습니다. (관리자·시설장)")
    return current_user


def _view(n: InternalNotice) -> dict:
    return {
        "id": n.id, "title": n.title, "content": n.content,
        "level": n.level or "info", "pinned": bool(n.pinned), "active": bool(n.active),
        "author_name": n.author_name,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


class NoticeBody(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    level: Optional[str] = None
    pinned: Optional[bool] = None
    active: Optional[bool] = None


@router.get("")
def list_notices(limit: int = Query(20), db: Session = Depends(get_db),
                 _: User = Depends(get_current_user)):
    rows = (db.query(InternalNotice)
            .filter(InternalNotice.active == True)  # noqa: E712
            .order_by(InternalNotice.pinned.desc(), InternalNotice.created_at.desc())
            .limit(max(1, min(limit, 100))).all())
    return ApiResponse(success=True, data=[_view(n) for n in rows])


@router.post("", status_code=201)
def create_notice(body: NoticeBody, db: Session = Depends(get_db),
                  current_user: User = Depends(_can_write)):
    if not (body.title or "").strip():
        raise HTTPException(400, "제목을 입력해주세요.")
    n = InternalNotice(
        title=body.title.strip(),
        content=(body.content or "").strip() or None,
        level=body.level if body.level in LEVELS else "info",
        pinned=bool(body.pinned),
        active=True,
        author_id=current_user.id,
        author_name=getattr(current_user, "name", None),
    )
    db.add(n); db.commit(); db.refresh(n)
    return ApiResponse(success=True, data=_view(n))


@router.patch("/{nid}")
def update_notice(nid: str, body: NoticeBody, db: Session = Depends(get_db),
                  _: User = Depends(_can_write)):
    n = db.query(InternalNotice).filter(InternalNotice.id == nid).first()
    if not n:
        raise HTTPException(404, "공지를 찾을 수 없습니다.")
    if body.title is not None and body.title.strip():
        n.title = body.title.strip()
    if body.content is not None:
        n.content = body.content.strip() or None
    if body.level is not None and body.level in LEVELS:
        n.level = body.level
    if body.pinned is not None:
        n.pinned = bool(body.pinned)
    if body.active is not None:
        n.active = bool(body.active)
    db.commit(); db.refresh(n)
    return ApiResponse(success=True, data=_view(n))


@router.delete("/{nid}")
def delete_notice(nid: str, db: Session = Depends(get_db), _: User = Depends(_can_write)):
    n = db.query(InternalNotice).filter(InternalNotice.id == nid).first()
    if not n:
        raise HTTPException(404, "공지를 찾을 수 없습니다.")
    db.delete(n); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")
