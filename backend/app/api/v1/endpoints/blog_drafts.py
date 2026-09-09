"""블로그 초안 — 목록 · 생성 · 검토 · 사진 동의.

발행은 하지 않는다. 네이버는 공식 글쓰기 API 가 없어, 사람이 본문을 복사해
붙여넣는다. 여기까지가 이 기능의 몫이다.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.blog_draft import (
    BlogDraft, BlogHistory, BlogPhotoUse,
    MASK_MASKED, USE_ALLOWED, USE_DENIED, USE_UNKNOWN,
)
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services import blog_run, blog_writer

logger = logging.getLogger(__name__)
router = APIRouter()

KST = timezone(timedelta(hours=9))


def _editor(current_user: User = Depends(get_current_user)) -> User:
    """공개 홍보에 나가는 글이라, 그것을 책임질 수 있는 사람까지만."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "사회복지사", "대표", "이사"):
        raise HTTPException(403, "블로그 초안 권한이 없습니다. (관리자·시설장·사회복지사·대표·이사)")
    return current_user


def _draft(d: BlogDraft) -> dict:
    return {
        "id": d.id, "run_key": d.run_key, "status": d.status,
        "title": d.title, "title_alts": d.title_alts or [],
        "blocks": d.blocks or [], "hashtags": d.hashtags or [],
        "topic": d.topic, "activity_dates": d.activity_dates or [],
        "source_note": d.source_note or "",
        "dup_status": d.dup_status, "dup_report": d.dup_report or {},
        "model": d.model, "cost_usd": d.cost_usd,
        "input_tokens": d.input_tokens, "output_tokens": d.output_tokens,
        "hold_reason": d.hold_reason,
        "created_by": d.created_by, "approved_by": d.approved_by,
        "approved_at": d.approved_at.isoformat() if d.approved_at else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        # 붙여넣을 본문 — 화면이 다시 만들지 않게 서버가 준다
        "body": blog_writer.body_text(
            d.blocks or [],
            {b.get("photo_id"): i + 1 for i, b in enumerate(
                [x for x in (d.blocks or []) if x.get("type") == "photo"])}),
        "facility": blog_writer.facility_block(),
    }


def _photo(p: BlogPhotoUse) -> dict:
    return {
        "id": p.id, "source": p.source, "source_id": p.source_id,
        "taken_on": p.taken_on, "program_title": p.program_title,
        "publicity": p.publicity, "publicity_by": p.publicity_by,
        "mask_status": p.mask_status, "mask_url": p.mask_url,
        "mask_detector": p.mask_detector, "mask_reason": p.mask_reason,
        "faces": len(p.mask_boxes or []),
        "reviewed_by": p.mask_reviewed_by,
        "reviewed_at": p.mask_reviewed_at.isoformat() if p.mask_reviewed_at else None,
        "sensitive": bool(p.sensitive),
        "usable": p.usable,
    }


# ── 초안 ──────────────────────────────────────────────────────────────────

@router.get("")
def list_drafts(status: Optional[str] = Query(None), limit: int = Query(30),
                db: Session = Depends(get_db), _: User = Depends(_editor)):
    q = db.query(BlogDraft)
    if status:
        q = q.filter(BlogDraft.status == status)
    rows = q.order_by(BlogDraft.created_at.desc()).limit(max(1, min(limit, 100))).all()
    return ApiResponse(success=True, data=[_draft(d) for d in rows])


@router.get("/pending-count")
def pending_count(db: Session = Depends(get_db), _: User = Depends(_editor)):
    """대시보드 '처리 대기' 에 쓰는 숫자.

    검토를 기다리는 초안과, 동의 확인을 기다리는 사진을 함께 낸다 —
    사진이 막혀 있으면 초안이 아예 안 만들어지므로 그것도 '할 일' 이다.
    """
    drafts = db.query(BlogDraft).filter(BlogDraft.status == "draft").count()
    photos = (db.query(BlogPhotoUse)
              .filter(BlogPhotoUse.mask_status == MASK_MASKED,
                      BlogPhotoUse.publicity == USE_UNKNOWN).count())
    return ApiResponse(success=True, data={"drafts": drafts, "photos_unconfirmed": photos})


@router.post("/generate")
def generate(db: Session = Depends(get_db), current_user: User = Depends(_editor)):
    """지금 한 편 만든다. 예약과 같은 길을 쓴다."""
    try:
        d = blog_run.build(db, created_by=getattr(current_user, "name", None))
    except blog_run.NotEnough as e:
        # 자료 부족은 오류가 아니다 — 무엇이 모자란지 그대로 알린다
        return ApiResponse(success=True, data={"created": False, "reason": str(e)})
    except Exception as e:
        logger.exception("초안 생성 실패")
        raise HTTPException(500, f"초안을 만들지 못했습니다: {type(e).__name__}")
    return ApiResponse(success=True, data={"created": True, "draft": _draft(d)})


class ApproveBody(BaseModel):
    status: str          # approved | held | draft
    hold_reason: Optional[str] = None


@router.post("/{draft_id}/status")
def set_status(draft_id: str, body: ApproveBody, db: Session = Depends(get_db),
               current_user: User = Depends(_editor)):
    d = db.query(BlogDraft).filter(BlogDraft.id == draft_id).first()
    if not d:
        raise HTTPException(404, "그 초안을 찾을 수 없습니다.")
    if body.status not in ("approved", "held", "draft"):
        raise HTTPException(400, "status 는 approved · held · draft 중 하나여야 합니다.")
    d.status = body.status
    d.hold_reason = (body.hold_reason or "").strip() or None
    if body.status == "approved":
        d.approved_by = getattr(current_user, "name", None)
        d.approved_at = datetime.now(KST)
    else:
        d.approved_by = None
        d.approved_at = None
    db.commit()
    db.refresh(d)
    return ApiResponse(success=True, data=_draft(d))


class EditBody(BaseModel):
    title: Optional[str] = None
    blocks: Optional[list] = None
    hashtags: Optional[list] = None


@router.patch("/{draft_id}")
def edit(draft_id: str, body: EditBody, db: Session = Depends(get_db),
         _: User = Depends(_editor)):
    """제목·본문·사진 순서를 고친다.

    검토를 마친 뒤 내용이 바뀌면 검토 상태를 되돌린다 — 승인된 것과 다른
    글이 나가면 승인이 의미가 없다.
    """
    d = db.query(BlogDraft).filter(BlogDraft.id == draft_id).first()
    if not d:
        raise HTTPException(404, "그 초안을 찾을 수 없습니다.")
    changed = False
    if body.title is not None and body.title.strip() != (d.title or ""):
        d.title = body.title.strip()[:200]; changed = True
    if body.blocks is not None:
        d.blocks = body.blocks; changed = True
    if body.hashtags is not None:
        d.hashtags = body.hashtags; changed = True
    if changed and d.status == "approved":
        d.status = "draft"
        d.approved_by = None
        d.approved_at = None
        d.content_rev = (d.content_rev or 0) + 1
    db.commit()
    db.refresh(d)
    return ApiResponse(success=True, data=_draft(d))


# ── 사진 (공개 사용 확인 · 가림 확인) ─────────────────────────────────────

@router.get("/photos")
def list_photos(state: Optional[str] = Query(None, description="unconfirmed | usable"),
                limit: int = Query(200),
                db: Session = Depends(get_db), _: User = Depends(_editor)):
    q = db.query(BlogPhotoUse)
    if state == "unconfirmed":
        q = q.filter(BlogPhotoUse.mask_status == MASK_MASKED,
                     BlogPhotoUse.publicity == USE_UNKNOWN)
    rows = q.order_by(BlogPhotoUse.taken_on.desc()).limit(max(1, min(limit, 500))).all()
    return ApiResponse(success=True, data=[_photo(p) for p in rows])


class PhotoBody(BaseModel):
    publicity: Optional[str] = None      # allowed | denied | unknown
    reviewed: Optional[bool] = None      # 가림을 눈으로 확인했는가
    sensitive: Optional[bool] = None
    note: Optional[str] = None


@router.patch("/photos/{photo_id}")
def set_photo(photo_id: str, body: PhotoBody, db: Session = Depends(get_db),
              current_user: User = Depends(_editor)):
    """이 사진을 공개 홍보에 써도 되는가 · 가림을 눈으로 봤는가.

    둘 다 사람이 정한다. 얼굴을 가렸다는 이유만으로 써도 된다고 보지 않는다 —
    보호자 앨범 열람 동의는 공개 홍보 동의가 아니다.
    """
    p = db.query(BlogPhotoUse).filter(BlogPhotoUse.id == photo_id).first()
    if not p:
        raise HTTPException(404, "그 사진을 찾을 수 없습니다.")
    if body.publicity is not None:
        if body.publicity not in (USE_ALLOWED, USE_DENIED, USE_UNKNOWN):
            raise HTTPException(400, "publicity 는 allowed · denied · unknown 중 하나여야 합니다.")
        p.publicity = body.publicity
        p.publicity_by = getattr(current_user, "name", None)
        p.publicity_at = datetime.now(KST)
        p.publicity_note = (body.note or "").strip() or None
    if body.reviewed is not None:
        if body.reviewed:
            p.mask_reviewed_by = getattr(current_user, "name", None)
            p.mask_reviewed_at = datetime.now(KST)
        else:
            p.mask_reviewed_by = None
            p.mask_reviewed_at = None
    if body.sensitive is not None:
        p.sensitive = bool(body.sensitive)
    db.commit()
    db.refresh(p)
    return ApiResponse(success=True, data=_photo(p))


# ── 발행 이력 (중복 검사의 기준) ──────────────────────────────────────────

class HistoryBody(BaseModel):
    log_no: str
    url: str
    title: Optional[str] = None
    body: Optional[str] = None
    published_on: Optional[str] = None
    activity_on: Optional[str] = None
    topic: Optional[str] = None
    highlights: Optional[list] = None
    summary: Optional[str] = None


@router.get("/histories")
def list_histories(db: Session = Depends(get_db), _: User = Depends(_editor)):
    rows = db.query(BlogHistory).order_by(BlogHistory.published_on.desc()).all()
    return ApiResponse(success=True, data=[{
        "id": h.id, "log_no": h.log_no, "url": h.url, "title": h.title,
        "published_on": h.published_on, "activity_on": h.activity_on,
        "topic": h.topic, "summary": h.summary,
        "highlights": h.highlights or [], "collected_by": h.collected_by,
        "body_len": len(h.body or ""),
    } for h in rows])


@router.post("/histories")
def add_history(body: HistoryBody, db: Session = Depends(get_db),
                _: User = Depends(_editor)):
    """이미 발행한 글을 등록한다 — 중복 검사의 기준이 된다.

    자동으로 못 가져오는 글은 여기에 주소와 본문을 붙여 넣는다. 확보하지
    못한 글이 있으면 중복 검사는 '통과' 라고 말하지 않는다.
    """
    log_no = (body.log_no or "").strip()
    if not log_no:
        raise HTTPException(400, "글 번호가 필요합니다.")
    row = db.query(BlogHistory).filter(BlogHistory.log_no == log_no).first()
    if not row:
        row = BlogHistory(log_no=log_no, url=body.url)
        db.add(row)
    row.url = body.url
    row.title = body.title
    row.body = body.body
    row.published_on = body.published_on
    row.activity_on = body.activity_on
    row.topic = body.topic
    row.highlights = body.highlights or []
    row.summary = body.summary
    row.collected_by = "manual"
    db.commit()
    db.refresh(row)
    return ApiResponse(success=True, data={"id": row.id, "log_no": row.log_no})
