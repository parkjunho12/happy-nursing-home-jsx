"""
시설소식(가정통신문) API.
- 작성/관리: ADMIN · 사회복지사
- 열람: 보호자(발행분만)
- 발행 시 전체 보호자에게 FCM 푸시
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.facility_news import FacilityNews, NEWS_CATEGORIES, now_kst
from app.models.push import FamilyPushToken
from app.services.fcm import send_to_tokens
from app.schemas.response import ApiResponse
from app.api.v1.endpoints.albums import get_guardian_id  # 보호자 인증 재사용

admin_router = APIRouter()
family_router = APIRouter()

KST = timezone(timedelta(hours=9))
UPLOAD_SUBDIR = "uploads/news"
MAX_SIZE = 10 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}
CATEGORY_EMOJI = {
    "일반": "📢", "행사": "🎉", "면회": "🤝", "건강": "💊",
    "식단": "🍚", "봉사": "💛", "긴급": "🚨", "기타": "📌",
}


def _require_news_manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "사회복지사":
        raise HTTPException(status_code=403, detail="시설소식 작성 권한이 없습니다. (관리자·사회복지사)")
    return current_user


def _kst_iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KST)
    return dt.astimezone(KST).isoformat()


def _view(n: FacilityNews, full: bool = False) -> dict:
    d = {
        "id": n.id, "category": n.category, "title": n.title,
        "summary": n.summary, "image_url": n.image_url,
        "is_pinned": bool(n.is_pinned), "is_published": bool(n.is_published),
        "author_name": n.author_name,
        "published_at": _kst_iso(n.published_at),
        "created_at": _kst_iso(n.created_at),
    }
    if full:
        d["content"] = n.content
    return d


def _save_image(f: UploadFile) -> str:
    ext = os.path.splitext(f.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"허용되지 않는 이미지 형식입니다: {ext}")
    data = f.file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "이미지가 너무 큽니다(최대 10MB).")
    os.makedirs(UPLOAD_SUBDIR, exist_ok=True)
    fid = str(uuid.uuid4())
    disk = f"{fid}{ext}"
    with open(os.path.join(UPLOAD_SUBDIR, disk), "wb") as out:
        out.write(data)
    return f"/uploads/news/{disk}"


def _unlink(url: Optional[str]):
    try:
        if url and url.startswith("/uploads/news/"):
            p = url.lstrip("/")
            if os.path.exists(p):
                os.remove(p)
    except Exception:
        pass


def _notify_all_guardians(db: Session, n: FacilityNews) -> dict:
    """발행 시 전체 보호자에게 푸시. 무효 토큰 정리."""
    try:
        rows = db.query(FamilyPushToken).all()
        tokens = [t.token for t in rows]
        if not tokens:
            return {"tokens": 0, "sent": 0, "failed": 0}
        emoji = CATEGORY_EMOJI.get(n.category, "📢")
        title = f"{emoji} 시설소식 · {n.category}"
        body = (n.summary or n.title or "").strip() or n.title
        sent, failed, invalid = send_to_tokens(
            tokens, title, body,
            data={"type": "news", "news_id": n.id, "title": n.title},
        )
        if invalid:
            db.query(FamilyPushToken).filter(FamilyPushToken.token.in_(invalid)).delete(synchronize_session=False)
            db.commit()
        return {"tokens": len(tokens), "sent": sent, "failed": failed}
    except Exception as e:
        db.rollback()
        return {"tokens": 0, "sent": 0, "failed": 0, "error": str(e)}


# ── Admin ──────────────────────────────────────────────────────────────────
@admin_router.get("/news")
def admin_list_news(db: Session = Depends(get_db), current_user: User = Depends(_require_news_manager)):
    rows = db.query(FacilityNews).order_by(
        FacilityNews.is_pinned.desc(), FacilityNews.created_at.desc()
    ).all()
    return ApiResponse(success=True, data=[_view(n) for n in rows])


@admin_router.post("/news")
def admin_create_news(
    category: str = Form("일반"),
    title: str = Form(...),
    summary: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    is_pinned: bool = Form(False),
    is_published: bool = Form(True),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_news_manager),
):
    if not title.strip():
        raise HTTPException(400, "제목을 입력해주세요.")
    img_url = _save_image(image) if (image and image.filename) else None
    now = now_kst()
    n = FacilityNews(
        category=category if category in NEWS_CATEGORIES else "일반",
        title=title.strip(),
        summary=(summary or "").strip() or None,
        content=(content or "").strip() or None,
        image_url=img_url,
        is_pinned=bool(is_pinned),
        is_published=bool(is_published),
        author_id=current_user.id,
        author_name=getattr(current_user, "name", None),
        published_at=now if is_published else None,
    )
    db.add(n); db.commit(); db.refresh(n)

    push = None
    if n.is_published:
        push = _notify_all_guardians(db, n)
    return ApiResponse(success=True, data={**_view(n, full=True), "push": push})


@admin_router.patch("/news/{nid}")
def admin_update_news(
    nid: str,
    category: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    is_pinned: Optional[bool] = Form(None),
    is_published: Optional[bool] = Form(None),
    remove_image: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_news_manager),
):
    n = db.query(FacilityNews).filter(FacilityNews.id == nid).first()
    if not n:
        raise HTTPException(404, "시설소식을 찾을 수 없습니다.")
    was_published = bool(n.is_published)

    if category is not None and category in NEWS_CATEGORIES:
        n.category = category
    if title is not None and title.strip():
        n.title = title.strip()
    if summary is not None:
        n.summary = summary.strip() or None
    if content is not None:
        n.content = content.strip() or None
    if is_pinned is not None:
        n.is_pinned = bool(is_pinned)
    if remove_image:
        _unlink(n.image_url); n.image_url = None
    if image and image.filename:
        _unlink(n.image_url)
        n.image_url = _save_image(image)
    if is_published is not None:
        n.is_published = bool(is_published)
        if n.is_published and n.published_at is None:
            n.published_at = now_kst()
    n.updated_at = now_kst()
    db.commit(); db.refresh(n)

    push = None
    if (not was_published) and n.is_published:   # 초안 → 발행 전환 시에만 푸시
        push = _notify_all_guardians(db, n)
    return ApiResponse(success=True, data={**_view(n, full=True), "push": push})


@admin_router.delete("/news/{nid}")
def admin_delete_news(nid: str, db: Session = Depends(get_db),
                      current_user: User = Depends(_require_news_manager)):
    n = db.query(FacilityNews).filter(FacilityNews.id == nid).first()
    if not n:
        raise HTTPException(404, "시설소식을 찾을 수 없습니다.")
    _unlink(n.image_url)
    db.delete(n); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@admin_router.post("/news/{nid}/notify")
def admin_notify_news(nid: str, db: Session = Depends(get_db),
                      current_user: User = Depends(_require_news_manager)):
    n = db.query(FacilityNews).filter(FacilityNews.id == nid).first()
    if not n:
        raise HTTPException(404, "시설소식을 찾을 수 없습니다.")
    if not n.is_published:
        raise HTTPException(400, "발행된 소식만 알림을 보낼 수 있습니다.")
    return ApiResponse(success=True, data=_notify_all_guardians(db, n))


# ── Family(보호자) ───────────────────────────────────────────────────────────
@family_router.get("/news")
def family_list_news(
    category: Optional[str] = Query(None),
    gid: str = Depends(get_guardian_id),
    db: Session = Depends(get_db),
):
    q = db.query(FacilityNews).filter(FacilityNews.is_published == True)  # noqa: E712
    if category and category in NEWS_CATEGORIES:
        q = q.filter(FacilityNews.category == category)
    rows = q.order_by(
        FacilityNews.is_pinned.desc(),
        func.coalesce(FacilityNews.published_at, FacilityNews.created_at).desc(),
    ).all()
    return ApiResponse(success=True, data=[_view(n) for n in rows])


@family_router.get("/news/{nid}")
def family_news_detail(nid: str, gid: str = Depends(get_guardian_id), db: Session = Depends(get_db)):
    n = db.query(FacilityNews).filter(
        FacilityNews.id == nid, FacilityNews.is_published == True  # noqa: E712
    ).first()
    if not n:
        raise HTTPException(404, "시설소식을 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_view(n, full=True))
