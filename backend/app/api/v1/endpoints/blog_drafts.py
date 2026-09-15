"""블로그 초안 — 목록 · 생성 · 검토 · 사진 동의 · 발행.

네이버는 공식 글쓰기 API 가 없다. 그래서 발행은 사람이 네이버에 로그인해 둔
Aside 브라우저(Mac)에서 브라우저 에이전트가 한다. 서버는 검토가 끝난 글을
줄 세우고, Mac 의 발행기(apps/blog-publisher)가 여기 /publisher/* 로 와서
한 편씩 가져가 올린 뒤 결과를 돌려준다. 규칙은 services/blog_publish 에 있다.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.blog_draft import (
    BlogDraft, BlogHistory, BlogPhotoUse,
    MASK_MASKED, USE_ALLOWED, USE_DENIED, USE_UNKNOWN,
)
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services import blog_publish as pub
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
        # 발행
        "publish_requested_by": d.publish_requested_by,
        "publish_requested_at": d.publish_requested_at.isoformat() if d.publish_requested_at else None,
        "publish_worker": d.publish_worker,
        "publish_lease_until": d.publish_lease_until.isoformat() if d.publish_lease_until else None,
        "publish_attempts": d.publish_attempts or 0,
        "publish_error": d.publish_error,
        "publish_session": d.publish_session,
        "published_url": d.published_url,
        "published_log_no": d.published_log_no,
        "published_at": d.published_at.isoformat() if d.published_at else None,
        "published_verified": bool(d.published_verified),
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
        # 사진 점수(0~100) — 같은 활동에서 선명하고 밝은 사진부터 쓰인다
        "quality": p.quality,
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
    # 발행에 실패해 사람이 봐야 하는 것 — 올라갔는지 모르는 글이 여기 있다
    failed = db.query(BlogDraft).filter(BlogDraft.status == pub.ST_FAILED).count()
    return ApiResponse(success=True, data={"drafts": drafts, "photos_unconfirmed": photos,
                                           "publish_failed": failed})


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
    if d.status in (pub.ST_QUEUED, pub.ST_PUBLISHING, pub.ST_PUBLISHED):
        raise HTTPException(409, "발행 대기·발행 중·발행된 초안은 검토 상태를 바꿀 수 없습니다. "
                                 "발행 대기는 먼저 취소해 주세요.")
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
    if d.status in (pub.ST_QUEUED, pub.ST_PUBLISHING, pub.ST_PUBLISHED):
        raise HTTPException(409, "발행 대기·발행 중·발행된 글은 고칠 수 없습니다. "
                                 "발행 대기는 먼저 취소해 주세요.")
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


# ── 발행 (관리자) ─────────────────────────────────────────────────────────

@router.post("/{draft_id}/publish")
def request_publish(draft_id: str, db: Session = Depends(get_db),
                    current_user: User = Depends(_editor)):
    """검토가 끝난 글을 발행 줄에 세운다. Mac 의 발행기가 가져가 Aside 로 올린다.

    되돌릴 수 없는 일이라 검토 완료(approved) 상태에서만 받는다. 발행에 실패한
    글은 사람이 네이버를 확인한 뒤 여기로 다시 올린다.
    """
    d = db.query(BlogDraft).filter(BlogDraft.id == draft_id).first()
    if not d:
        raise HTTPException(404, "그 초안을 찾을 수 없습니다.")
    try:
        d = pub.request(db, d, getattr(current_user, "name", None))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return ApiResponse(success=True, data=_draft(d))


@router.post("/{draft_id}/publish/cancel")
def cancel_publish(draft_id: str, db: Session = Depends(get_db), _: User = Depends(_editor)):
    d = db.query(BlogDraft).filter(BlogDraft.id == draft_id).first()
    if not d:
        raise HTTPException(404, "그 초안을 찾을 수 없습니다.")
    try:
        d = pub.cancel(db, d)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return ApiResponse(success=True, data=_draft(d))


@router.get("/publishers")
def list_publishers(db: Session = Depends(get_db), _: User = Depends(_editor)):
    """발행기가 살아 있는가 — 마지막 신호 시각. 없으면 아직 설치·로그인이 안 된 것이다."""
    return ApiResponse(success=True, data={
        "configured": bool(settings.BLOG_PUBLISHER_TOKEN),
        "publishers": pub.publishers(db),
    })


# ── 발행기 (Mac 의 apps/blog-publisher 가 부른다) ────────────────────────
#
# 사람 계정이 아니라 토큰으로 온다. 토큰은 서버 .env 의 BLOG_PUBLISHER_TOKEN 과
# 발행기 config.json 에만 있다. 토큰이 비어 있으면 이 문은 닫혀 있다.

def _publisher(x_publisher_token: Optional[str] = Header(None, alias="X-Publisher-Token"),
               x_publisher_name: Optional[str] = Header(None, alias="X-Publisher-Name")) -> str:
    expected = (settings.BLOG_PUBLISHER_TOKEN or "").strip()
    if not expected:
        raise HTTPException(503, "발행기 토큰(BLOG_PUBLISHER_TOKEN)이 서버에 설정되지 않았습니다.")
    if not x_publisher_token or not secrets.compare_digest(
            x_publisher_token.strip().encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(401, "발행기 토큰이 맞지 않습니다.")
    return (x_publisher_name or "publisher").strip()[:100]


class HeartbeatBody(BaseModel):
    aside_version: Optional[str] = None
    naver_blog_id: Optional[str] = None
    host: Optional[str] = None


@router.post("/publisher/heartbeat")
def publisher_heartbeat(body: HeartbeatBody, db: Session = Depends(get_db),
                        worker: str = Depends(_publisher)):
    pub.heartbeat(db, worker, body.model_dump(exclude_none=True))
    return ApiResponse(success=True, data={"ok": True})


@router.post("/publisher/next")
def publisher_next(db: Session = Depends(get_db), worker: str = Depends(_publisher)):
    """다음 한 편을 가져간다. 없으면 draft: null.

    가져가는 순간 publishing 이 되고 임대 시한이 적힌다. 꾸러미를 만들지
    못하면(사진을 쓸 수 없게 됐다 등) 그 자리에서 실패로 돌린다 — 발행기가
    반쪽짜리 글을 올리지 않게.
    """
    pub.heartbeat(db, worker)
    d = pub.lease_next(db, worker)
    if not d:
        return ApiResponse(success=True, data={"draft": None})
    try:
        pkg = pub.package(db, d)
    except ValueError as e:
        # 사람이 고쳐야 나갈 수 있는 글 — 재시도 없이 멈춘다. 다음 편은 나갈 수 있다
        pub.abort(db, d, f"꾸러미를 만들지 못했습니다: {e}")
        return ApiResponse(success=True, data={"draft": None, "skipped": d.id, "reason": str(e)})
    return ApiResponse(success=True, data={"draft": pkg})


class ResultBody(BaseModel):
    result: str                      # ok | failed | uncertain
    url: Optional[str] = None        # ok 일 때 글 주소
    error: Optional[str] = None
    session_id: Optional[str] = None # Aside 세션 id
    verified: bool = False           # 올라간 글을 실제로 열어 봤는가
    blog_id: Optional[str] = None    # 발행기가 아는 우리 블로그 아이디 — 주소가 이것과 다르면 받지 않는다


@router.post("/publisher/{draft_id}/result")
def publisher_result(draft_id: str, body: ResultBody, db: Session = Depends(get_db),
                     worker: str = Depends(_publisher)):
    d = db.query(BlogDraft).filter(BlogDraft.id == draft_id).first()
    if not d:
        raise HTTPException(404, "그 초안을 찾을 수 없습니다.")
    try:
        d = pub.complete(db, d, result=body.result, url=body.url, error=body.error,
                         session_id=body.session_id, verified=body.verified, worker=worker,
                         expected_blog_id=(body.blog_id or "").strip() or None)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return ApiResponse(success=True, data={"status": d.status, "published_url": d.published_url})


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
