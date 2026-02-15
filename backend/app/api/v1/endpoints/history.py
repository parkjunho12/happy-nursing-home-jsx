from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.history import History
from app.schemas.response import ApiResponse
from app.schemas.history import HistoryCreate, HistoryUpdate, HistoryResponse

router = APIRouter()

def to_history_dict(obj: History) -> dict:
    # ORM -> Pydantic -> dict
    return HistoryResponse.model_validate(obj).model_dump()


def simple_slugify(title: str) -> str:
    # slugify 라이브러리 없이도 동작하는 최소 slug 생성기
    # (한글이면 그대로 남을 수 있음. 필요하면 별도 slugify 패키지 추가 권장)
    import re
    s = title.strip().lower()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9\-]+", "", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "post"


@router.get("", response_model=ApiResponse)
def list_history(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 목록 조회"""
    rows = db.query(History).order_by(History.created_at.desc()).all()
    data = [to_history_dict(x) for x in rows]
    return ApiResponse(success=True, data=data)


@router.get("/{history_id}", response_model=ApiResponse)
def get_history(
    history_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 상세 조회 + 조회수 증가"""
    row = db.query(History).filter(History.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")

    row.view_count = (row.view_count or 0) + 1
    db.commit()
    db.refresh(row)

    return ApiResponse(success=True, data=to_history_dict(row))


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_history(
    payload: HistoryCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 생성"""
    data = payload.model_dump()

    # slug 자동 생성(비어있거나 공백이면 생성)
    if not data.get("slug"):
        data["slug"] = simple_slugify(data["title"])

    # slug 중복 방지: 동일 slug 있으면 -2, -3...
    base_slug = data["slug"]
    slug = base_slug
    i = 2
    while db.query(History).filter(History.slug == slug).first():
        slug = f"{base_slug}-{i}"
        i += 1
    data["slug"] = slug

    row = History(**data)
    db.add(row)
    db.commit()
    db.refresh(row)

    return ApiResponse(success=True, data=to_history_dict(row))


@router.put("/{history_id}", response_model=ApiResponse)
def update_history(
    history_id: str,
    payload: HistoryUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 수정 (부분 업데이트)"""
    row = db.query(History).filter(History.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")

    patch = payload.model_dump(exclude_unset=True)

    # title 변경 + slug 미지정이면 slug 재생성
    if "title" in patch and "slug" not in patch:
        patch["slug"] = simple_slugify(patch["title"])

    # slug 변경 시 중복 체크
    if "slug" in patch and patch["slug"]:
        exists = (
            db.query(History)
            .filter(History.slug == patch["slug"], History.id != history_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=409, detail="Slug already exists")

    for k, v in patch.items():
        setattr(row, k, v)

    # updated_at은 DB onupdate가 있긴 하지만, 명시적으로 찍고 싶다면 유지
    row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return ApiResponse(success=True, data=to_history_dict(row))


@router.delete("/{history_id}", response_model=ApiResponse)
def delete_history(
    history_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 삭제"""
    row = db.query(History).filter(History.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")

    db.delete(row)
    db.commit()
    return ApiResponse(success=True, message="History deleted")


@router.post("/{history_id}/publish", response_model=ApiResponse)
def publish_history(
    history_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 공개"""
    row = db.query(History).filter(History.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")

    row.is_published = True
    row.published_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return ApiResponse(success=True, data=to_history_dict(row))


@router.post("/{history_id}/unpublish", response_model=ApiResponse)
def unpublish_history(
    history_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """히스토리 비공개"""
    row = db.query(History).filter(History.id == history_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="History not found")

    row.is_published = False
    row.published_at = None  # ✅ 보통 비공개면 published_at도 제거

    db.commit()
    db.refresh(row)
    return ApiResponse(success=True, data=to_history_dict(row))
