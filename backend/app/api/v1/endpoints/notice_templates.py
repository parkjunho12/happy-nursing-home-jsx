"""내부 공지 작성 템플릿 (공용) — 읽기: 전 직원 / 쓰기: ADMIN · 시설장"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staffing import NoticeTemplate
from app.schemas.response import ApiResponse

router = APIRouter()
LEVELS = ("info", "important", "urgent")


def _can_write(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "템플릿 편집 권한이 없습니다. (관리자·시설장)")
    return current_user


def _view(t: NoticeTemplate) -> dict:
    return {
        "id": t.id, "name": t.name, "level": t.level or "info",
        "title": t.title, "content": t.content, "image_url": getattr(t, "image_url", None),
        "sort_order": t.sort_order or 0,
    }


class TemplateBody(BaseModel):
    name: Optional[str] = None
    level: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None


@router.get("")
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (db.query(NoticeTemplate)
            .order_by(NoticeTemplate.sort_order.asc(), NoticeTemplate.created_at.asc())
            .all())
    return ApiResponse(success=True, data=[_view(t) for t in rows])


@router.post("", status_code=201)
def create_template(body: TemplateBody, db: Session = Depends(get_db), _: User = Depends(_can_write)):
    if not (body.name or "").strip():
        raise HTTPException(400, "템플릿 이름을 입력해주세요.")
    t = NoticeTemplate(
        name=body.name.strip(),
        level=body.level if body.level in LEVELS else "info",
        title=(body.title or "").strip() or None,
        content=(body.content or "").strip() or None,
        image_url=(body.image_url or None),
        sort_order=body.sort_order or 0,
    )
    db.add(t); db.commit(); db.refresh(t)
    return ApiResponse(success=True, data=_view(t))


@router.patch("/{tid}")
def update_template(tid: str, body: TemplateBody, db: Session = Depends(get_db), _: User = Depends(_can_write)):
    t = db.query(NoticeTemplate).filter(NoticeTemplate.id == tid).first()
    if not t:
        raise HTTPException(404, "템플릿을 찾을 수 없습니다.")
    if body.name is not None and body.name.strip():
        t.name = body.name.strip()
    if body.level is not None and body.level in LEVELS:
        t.level = body.level
    if body.title is not None:
        t.title = body.title.strip() or None
    if body.content is not None:
        t.content = body.content.strip() or None
    if body.image_url is not None:
        t.image_url = body.image_url.strip() or None
    if body.sort_order is not None:
        t.sort_order = int(body.sort_order)
    db.commit(); db.refresh(t)
    return ApiResponse(success=True, data=_view(t))


@router.delete("/{tid}")
def delete_template(tid: str, db: Session = Depends(get_db), _: User = Depends(_can_write)):
    t = db.query(NoticeTemplate).filter(NoticeTemplate.id == tid).first()
    if not t:
        raise HTTPException(404, "템플릿을 찾을 수 없습니다.")
    db.delete(t); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")
