import time
import logging
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.core.database import get_db

# ⚠️ 중요: 백그라운드 태스크에서 "새 DB 세션"을 만들기 위해 SessionLocal 필요
# 네 프로젝트의 app/core/database.py에 SessionLocal이 정의돼 있어야 함.
# 보통: SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
from app.core.database import SessionLocal  # <-- 만약 여기서 ImportError 나면 database.py 확인 필요

# ✅ Contact는 admin이 보는 contacts 테이블로 저장
from app.models.contact import Contact, ContactStatus

# ✅ 나머지는 public 전용 테이블 그대로 사용
from app.models.public import (
    PublicHistoryPost, PublicReview,
    PublicService, PublicDifferentiator, PublicInfo
)

from app.schemas.public import (
    ContactFormRequest,
    HistoryListItem, HistoryDetail,
    ReviewItem, ServiceItem, DifferentiatorItem,
    PublicInfoOut,
    PublicApiResponse, PublicApiListResponse,
)

from app.schemas.ai import ContactAnalysisRequest
from app.services.openai import analyze_contact_inquiry

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Background Task: AI 분석 후 contacts 테이블에 저장
# ============================================================
async def _run_ai_analysis_and_save(contact_id: int) -> None:
    """
    백그라운드에서 AI 분석 수행 후 contacts 테이블에 저장.
    - 요청/응답을 막지 않음
    - 요청에서 받은 db 세션을 재사용하지 않고 새 SessionLocal() 사용 (중요)
    """
    db = SessionLocal()
    try:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            logger.warning(f"[AI] contact not found: id={contact_id}")
            return

        ai_request = ContactAnalysisRequest(
            name=contact.name,
            inquiry_type=contact.inquiry_type,
            message=contact.message,
            phone=contact.phone,
            email=contact.email,
        )

        ai_result = await analyze_contact_inquiry(ai_request)

        if not ai_result:
            logger.info(f"[AI] analysis skipped (maybe no API key): id={contact_id}")
            return

        # AI 결과 저장
        contact.ai_summary = ai_result.summary
        contact.ai_category = ai_result.category
        contact.ai_urgency = ai_result.urgency
        contact.ai_next_actions = ai_result.next_actions
        contact.ai_model = "openai"
        contact.ai_created_at = datetime.utcnow()

        db.commit()
        logger.info(
            f"[AI] saved: id={contact_id}, category={ai_result.category}, urgency={ai_result.urgency}"
        )

    except Exception as e:
        db.rollback()
        logger.exception(f"[AI] failed: id={contact_id}, err={e}")
    finally:
        db.close()


# -------------------------
# Contact  (✅ public -> contacts 테이블에 저장)
# -------------------------
@router.post(
    "/contact",
    response_model=PublicApiResponse[dict],
    status_code=status.HTTP_201_CREATED,
)
async def submit_contact_form(
    form: ContactFormRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    상담문의 접수:
    1) contacts 테이블에 즉시 저장하고
    2) AI 분석은 BackgroundTasks로 비동기 수행 (응답 지연 없음)
    """

    # ticket_id 생성: CNT-<epoch>-<short-uuid>
    ticket_id = f"CNT-{int(time.time())}-{uuid4().hex[:6]}"

    row = Contact(
        ticket_id=ticket_id,
        name=form.name,
        phone=form.phone,
        email=str(form.email) if form.email else None,
        inquiry_type=form.inquiry_type,
        message=form.message,
        privacy_agreed=form.privacy_agreed,
        status=ContactStatus.PENDING,
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    logger.info(f"Contact created: ticket_id={ticket_id}, id={row.id}")

    # ✅ AI 분석은 백그라운드로
    background_tasks.add_task(_run_ai_analysis_and_save, row.id)

    # ✅ response_model이 PublicApiResponse[dict] 이므로 dict로 감싸서 반환
    return PublicApiResponse(
        success=True,
        data={
            "id": row.id,
            "ticket_id": row.ticket_id,
            "status": row.status,
        },
    )


# -------------------------
# History (published only)
# -------------------------
@router.get(
    "/history",
    response_model=PublicApiListResponse[HistoryListItem],
)
def get_published_history(db: Session = Depends(get_db)):
    rows = (
        db.query(PublicHistoryPost)
        .filter(PublicHistoryPost.is_published.is_(True))
        .order_by(desc(PublicHistoryPost.published_at), desc(PublicHistoryPost.id))
        .all()
    )

    items = [
        HistoryListItem(
            id=r.id,
            title=r.title,
            slug=r.slug,
            category=r.category,
            excerpt=r.excerpt,
            publishedAt=r.published_at,
        )
        for r in rows
    ]

    return PublicApiListResponse(success=True, data=items)


@router.get(
    "/history/{slug}",
    response_model=PublicApiResponse[HistoryDetail],
)
def get_history_post(slug: str, db: Session = Depends(get_db)):
    r = (
        db.query(PublicHistoryPost)
        .filter(
            PublicHistoryPost.slug == slug,
            PublicHistoryPost.is_published.is_(True),
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    detail = HistoryDetail(
        id=r.id,
        title=r.title,
        slug=r.slug,
        content=r.content_html,
        publishedAt=r.published_at,
    )

    return PublicApiResponse(success=True, data=detail)


# -------------------------
# Reviews (approved only)
# -------------------------
@router.get(
    "/reviews",
    response_model=PublicApiListResponse[ReviewItem],
)
def get_approved_reviews(db: Session = Depends(get_db)):
    rows = (
        db.query(PublicReview)
        .filter(PublicReview.approved.is_(True))
        .order_by(desc(PublicReview.featured), desc(PublicReview.approved_at), desc(PublicReview.id))
        .all()
    )

    items = [
        ReviewItem(
            id=r.id,
            author=r.author,
            rating=r.rating,
            content=r.content,
            date=r.date,
            verified=r.verified,
            featured=r.featured,
        )
        for r in rows
    ]

    return PublicApiListResponse(success=True, data=items)


# -------------------------
# Services
# -------------------------
@router.get(
    "/services",
    response_model=PublicApiListResponse[ServiceItem],
)
def get_services(db: Session = Depends(get_db)):
    rows = (
        db.query(PublicService)
        .filter(PublicService.is_active.is_(True))
        .order_by(asc(PublicService.sort_order), asc(PublicService.id))
        .all()
    )

    items = [
        ServiceItem(
            id=r.id,
            icon=r.icon,
            title=r.title,
            description=r.description,
            features=(r.features or []),
        )
        for r in rows
    ]

    return PublicApiListResponse(success=True, data=items)


# -------------------------
# Differentiators
# -------------------------
@router.get(
    "/differentiators",
    response_model=PublicApiListResponse[DifferentiatorItem],
)
def get_differentiators(db: Session = Depends(get_db)):
    rows = (
        db.query(PublicDifferentiator)
        .filter(PublicDifferentiator.is_active.is_(True))
        .order_by(asc(PublicDifferentiator.sort_order), asc(PublicDifferentiator.id))
        .all()
    )

    items = [
        DifferentiatorItem(
            id=r.id,
            icon=r.icon,
            title=r.title,
            description=r.description,
        )
        for r in rows
    ]

    return PublicApiListResponse(success=True, data=items)


# -------------------------
# Public info (single row)
# -------------------------
@router.get(
    "/info",
    response_model=PublicApiResponse[PublicInfoOut],
)
def get_public_info(db: Session = Depends(get_db)):
    row = db.query(PublicInfo).filter(PublicInfo.id == 1).first()
    if not row:
        raise HTTPException(status_code=404, detail="Public info not configured")

    out = PublicInfoOut(
        name=row.name,
        address=row.address,
        phone=row.phone,
        hours=row.hours,
        email=row.email,
    )

    return PublicApiResponse(success=True, data=out)
