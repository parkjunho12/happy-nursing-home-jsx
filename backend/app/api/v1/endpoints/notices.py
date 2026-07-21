"""내부 공지사항 (직원용) — 읽기: 전 직원 / 쓰기: ADMIN · 시설장"""
from __future__ import annotations
import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staffing import InternalNotice
from app.schemas.response import ApiResponse
from app.services.storage import save_upload
import os as _os
from app.core.config import settings as _settings
from app.services.fcm import is_available as _fcm_available
from app.models.staff_push import StaffPushToken
from app.models.push import FamilyPushToken
from app.services.staff_notify import notify_all_staff

router = APIRouter()
LEVELS = ("info", "important", "urgent")
UPLOAD_SUBDIR = "uploads/notices"
MAX_SIZE = 10 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}
LEVEL_PREFIX = {"urgent": "[긴급] ", "important": "[중요] ", "info": ""}


def _push_notice(db: Session, n: InternalNotice, author_id: Optional[str]) -> dict:
    """공지를 직원앱에 푸시. 본문이 없으면 제목만 보낸다."""
    title = f"{LEVEL_PREFIX.get(n.level or 'info', '')}공지 · {n.title}".strip()
    body = (n.content or "").strip() or "새 공지가 등록되었습니다. 앱에서 확인해주세요."
    if len(body) > 120:
        body = body[:119] + "…"
    return notify_all_staff(
        db, title, body,
        data={"type": "notice", "notice_id": n.id, "level": n.level or "info"},
        exclude_user_id=author_id,
    )


def _can_write(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos not in ("시설장", "사회복지사"):
        raise HTTPException(403, "공지 작성 권한이 없습니다. (관리자·시설장·사회복지사)")
    return current_user


def _view(n: InternalNotice) -> dict:
    return {
        "id": n.id, "title": n.title, "content": n.content,
        "level": n.level or "info", "pinned": bool(n.pinned), "active": bool(n.active),
        "public": bool(getattr(n, "public", False)),
        "image_url": getattr(n, "image_url", None),
        "content_images": getattr(n, "content_images", None) or [],
        "author_name": n.author_name,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


class NoticeBody(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    level: Optional[str] = None
    pinned: Optional[bool] = None
    active: Optional[bool] = None
    public: Optional[bool] = None   # True=로그인 없이 링크로 열람 가능(공개 공지)
    image_url: Optional[str] = None # 공유 카드·상세 이미지 (upload-image로 받은 경로)
    content_images: Optional[List[str]] = None  # 본문 아래 갤러리 이미지 경로 배열
    push: Optional[bool] = True     # 등록 시 직원앱 푸시 발송 여부


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
        public=bool(body.public),
        image_url=(body.image_url or None),
        content_images=(body.content_images or None),
        author_id=current_user.id,
        author_name=getattr(current_user, "name", None),
    )
    db.add(n); db.commit(); db.refresh(n)

    # 푸시는 실패해도 공지 등록은 성공 처리 (notify_all_staff 내부에서 예외 흡수)
    push = _push_notice(db, n, current_user.id) if (body.push is not False) else None

    data = _view(n)
    data["push"] = push
    return ApiResponse(success=True, data=data)


@router.post("/{nid}/push")
def push_notice(nid: str, db: Session = Depends(get_db),
                current_user: User = Depends(_can_write)):
    """등록된 공지를 직원앱에 재발송."""
    n = db.query(InternalNotice).filter(InternalNotice.id == nid).first()
    if not n:
        raise HTTPException(404, "공지를 찾을 수 없습니다.")
    if not n.active:
        raise HTTPException(400, "비활성 공지는 발송할 수 없습니다.")
    result = _push_notice(db, n, None)   # 재발송은 작성자 포함 전원
    return ApiResponse(success=True, data=result, message=f"{result.get('sent', 0)}건 발송")


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
    if body.public is not None:
        n.public = bool(body.public)
    if body.image_url is not None:
        n.image_url = body.image_url.strip() or None
    if body.content_images is not None:
        n.content_images = body.content_images or None
    db.commit(); db.refresh(n)
    return ApiResponse(success=True, data=_view(n))


@router.delete("/{nid}")
def delete_notice(nid: str, db: Session = Depends(get_db), _: User = Depends(_can_write)):
    n = db.query(InternalNotice).filter(InternalNotice.id == nid).first()
    if not n:
        raise HTTPException(404, "공지를 찾을 수 없습니다.")
    db.delete(n); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.post("/upload-image")
def upload_notice_image(file: UploadFile = File(...), _: User = Depends(_can_write)):
    """공지·템플릿용 이미지 업로드 → 저장 경로(/uploads/notices/..) 반환."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"허용되지 않는 이미지 형식입니다: {ext}")
    data = file.file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "이미지가 너무 큽니다(최대 10MB).")
    url = save_upload(data, "notices", file.filename, file.content_type)
    return ApiResponse(success=True, data={"url": url})


@router.get("/push-status")
def push_status(db: Session = Depends(get_db), _: User = Depends(_can_write)):
    """푸시가 왜 안 가는지 한 번에 진단.

    지금까지는 자격 미설정이면 로그 한 줄 남기고 조용히 비활성이라
    '보냈다는데 안 온다'를 추적할 방법이 없었다."""
    cred = _settings.FCM_CREDENTIALS_FILE
    try:
        staff_tokens = db.query(StaffPushToken).count()
    except Exception:
        staff_tokens = -1
    try:
        family_tokens = db.query(FamilyPushToken).count()
    except Exception:
        family_tokens = -1
    return ApiResponse(success=True, data={
        "fcm_available": _fcm_available(),
        "credentials_file": cred or "(미설정)",
        "credentials_exists": bool(cred and _os.path.isfile(cred)),
        "staff_tokens": staff_tokens,       # 직원앱 등록 기기 수
        "family_tokens": family_tokens,     # 보호자앱 등록 기기 수
        "hint": ("정상" if _fcm_available()
                 else "FCM_CREDENTIALS_FILE 미설정 또는 파일 없음 — infra/secrets/에 서비스계정 JSON을 넣고 재기동하세요"),
    })
