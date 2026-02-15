from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
import time

from app.core.database import get_db

# ✅ Contact는 admin이 보는 contacts 테이블로 저장해야 함
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

router = APIRouter()

# -------------------------
# Contact  (✅ public -> contacts 테이블에 저장)
# -------------------------

@router.post(
    "/contact",
    response_model=PublicApiResponse[dict],
    status_code=status.HTTP_201_CREATED,
)
def submit_contact_form(form: ContactFormRequest, db: Session = Depends(get_db)):
    # ticket_id 생성: CNT-<epoch>
    ticket_id = f"CNT-{int(time.time())}"

    row = Contact(
        ticket_id=ticket_id,
        name=form.name,
        phone=form.phone,
        email=str(form.email) if form.email else None,
        inquiry_type=form.inquiry_type,
        message=form.message,
        privacy_agreed=form.privacy_agreed,
        status=ContactStatus.PENDING,  # ✅ Enum으로 통일
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return PublicApiResponse(
        success=True,
        message="상담 신청이 접수되었습니다",
        data={"ticket_id": row.ticket_id, "id": row.id},
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
