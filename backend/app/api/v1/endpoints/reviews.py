from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.review import Review
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.review import ReviewResponse

router = APIRouter()

def to_review_dict(obj: Review) -> dict:
    return ReviewResponse.model_validate(obj).model_dump()


@router.get("", response_model=ApiResponse)
def list_reviews(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """후기 목록 조회"""
    rows = db.query(Review).order_by(Review.created_at.desc()).all()
    data = [to_review_dict(r) for r in rows]
    return ApiResponse(success=True, data=data)


@router.get("/{review_id}", response_model=ApiResponse)
def get_review(
    review_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """후기 상세 조회"""
    row = db.query(Review).filter(Review.id == review_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    return ApiResponse(success=True, data=to_review_dict(row))


@router.post("/{review_id}/approve", response_model=ApiResponse)
def approve_review(
    review_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """후기 승인"""
    row = db.query(Review).filter(Review.id == review_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")

    row.is_approved = True
    row.approved_at = datetime.utcnow()
    row.approved_by = current_user.name or current_user.email

    db.commit()
    db.refresh(row)
    return ApiResponse(success=True, data=to_review_dict(row), message="Review approved")


@router.post("/{review_id}/reject", response_model=ApiResponse)
def reject_review(
    review_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """후기 거부 (삭제)"""
    row = db.query(Review).filter(Review.id == review_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")

    db.delete(row)
    db.commit()
    return ApiResponse(success=True, message="Review rejected and deleted")


@router.delete("/{review_id}", response_model=ApiResponse)
def delete_review(
    review_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """후기 삭제"""
    row = db.query(Review).filter(Review.id == review_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")

    db.delete(row)
    db.commit()
    return ApiResponse(success=True, message="Review deleted")
