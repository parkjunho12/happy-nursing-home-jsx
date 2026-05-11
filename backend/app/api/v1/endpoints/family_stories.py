from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db

from app.models.family_story import FamilyStory, FamilyStoryPhoto
from app.models.resident import Resident
from app.schemas.family_story import (
    FamilyStoryCreate,
    FamilyStoryUpdate,
)

router = APIRouter()

# ===== Helper Function =====

def to_story_dict(story: FamilyStory, db: Session) -> dict:
    """FamilyStory를 딕셔너리로 변환"""
    resident = db.query(Resident).filter(Resident.id == story.resident_id).first()
    
    return {
        "id": str(story.id),
        "resident_id": str(story.resident_id),
        "resident_name": resident.name if resident else "알 수 없음",
        "author_id": str(story.author_id) if story.author_id else None,
        "title": story.title,
        "content": story.content,
        "story_date": story.story_date.isoformat(),
        "status": story.status,
        "privacy_confirmed": story.privacy_confirmed,
        "photos": [
            {
                "id": str(photo.id),
                "story_id": str(photo.story_id),
                "file_url": photo.file_url,
                "file_name": photo.file_name,
                "display_order": photo.display_order,
                "created_at": photo.created_at.isoformat()
            }
            for photo in sorted(story.photos, key=lambda x: x.display_order)
        ],
        "created_at": story.created_at.isoformat(),
        "updated_at": story.updated_at.isoformat()
    }


# ===== Routes =====

@router.get("/")
def list_family_stories(
    resident_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    # current_user = Depends(get_current_user)  # Admin 권한 체크 (나중에 활성화)
):
    """
    관리자용: 일상 공유 목록 조회
    
    Query Parameters:
    - resident_id: 특정 어르신 필터 (선택)
    - status_filter: draft 또는 published 필터 (선택)
    - skip: 페이지네이션 시작 (기본: 0)
    - limit: 페이지 크기 (기본: 100)
    """
    query = db.query(FamilyStory).options(joinedload(FamilyStory.photos))
    
    if resident_id:
        query = query.filter(FamilyStory.resident_id == resident_id)
    if status_filter:
        query = query.filter(FamilyStory.status == status_filter)
    
    stories = query.order_by(
        FamilyStory.story_date.desc()
    ).offset(skip).limit(limit).all()
    
    return [to_story_dict(story, db) for story in stories]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_family_story(
    story_data: FamilyStoryCreate,
    db: Session = Depends(get_db),
    # current_user = Depends(get_current_user)
):
    """
    관리자용: 일상 공유 작성
    
    - published 상태로 작성하려면 privacy_confirmed=true 필수
    - 사진은 별도 업로드 API 사용
    """
    # Resident 존재 확인
    resident = db.query(Resident).filter(
        Resident.id == story_data.resident_id
    ).first()
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 어르신을 찾을 수 없습니다"
        )
    
    # published 상태인데 개인정보 확인 안됐으면 에러
    if story_data.status == 'published' and not story_data.privacy_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="개인정보 보호 확인을 완료해야 공개할 수 있습니다"
        )
    
    # Story 생성
    story = FamilyStory(**story_data.dict())
    db.add(story)
    db.commit()
    db.refresh(story)
    
    return to_story_dict(story, db)


@router.get("/{story_id}")
def get_family_story(
    story_id: str,
    db: Session = Depends(get_db),
):
    """관리자용: 일상 공유 상세 조회"""
    story = db.query(FamilyStory).options(
        joinedload(FamilyStory.photos)
    ).filter(FamilyStory.id == story_id).first()
    
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다"
        )
    
    return to_story_dict(story, db)


@router.put("/{story_id}")
def update_family_story(
    story_id: str,
    story_update: FamilyStoryUpdate,
    db: Session = Depends(get_db),
):
    """
    관리자용: 일상 공유 수정
    
    - published로 변경 시 privacy_confirmed 필수
    """
    story = db.query(FamilyStory).filter(FamilyStory.id == story_id).first()
    
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다"
        )
    
    update_data = story_update.dict(exclude_unset=True)
    
    # published로 변경하는데 개인정보 확인 안됐으면 에러
    if update_data.get('status') == 'published':
        privacy_confirmed = update_data.get('privacy_confirmed', story.privacy_confirmed)
        if not privacy_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="개인정보 보호 확인을 완료해야 공개할 수 있습니다"
            )
    
    # 업데이트
    for field, value in update_data.items():
        setattr(story, field, value)
    
    story.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(story)
    
    return to_story_dict(story, db)


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family_story(
    story_id: str,
    db: Session = Depends(get_db),
):
    """
    관리자용: 일상 공유 삭제
    
    - 연결된 사진도 함께 삭제 (CASCADE)
    - 파일 시스템의 실제 파일도 삭제
    """
    story = db.query(FamilyStory).filter(FamilyStory.id == story_id).first()
    
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다"
        )
    
    # 사진 파일 삭제
    import os
    for photo in story.photos:
        try:
            file_path = f"app{photo.file_url}"
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Failed to delete file {photo.file_url}: {e}")
    
    # DB에서 삭제 (CASCADE로 photos도 자동 삭제)
    db.delete(story)
    db.commit()


@router.post("/{story_id}/photos")
async def upload_story_photos(
    story_id: str,
    files: List[UploadFile] = File(..., description="최대 10장"),
    db: Session = Depends(get_db),
):
    """
    관리자용: 일상 공유 사진 업로드
    
    - 최대 10장까지 업로드 가능
    - display_order는 자동으로 설정됨
    - 파일은 /app/uploads/family_stories/ 에 저장
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="최대 10장까지 업로드 가능합니다"
        )
    
    # Story 존재 확인
    story = db.query(FamilyStory).filter(FamilyStory.id == story_id).first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다"
        )
    
    # 현재 최대 display_order
    max_order = db.query(FamilyStoryPhoto).filter(
        FamilyStoryPhoto.story_id == story_id
    ).count()
    
    uploaded_photos = []
    
    # 파일 업로드
    import os
    from pathlib import Path
    import uuid
    
    upload_dir = Path("app/uploads/family_stories")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    for idx, file in enumerate(files):
        # 파일명 생성 (UUID + 원본 확장자)
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = upload_dir / unique_filename
        
        # 파일 저장
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # DB 레코드 생성
        file_url = f"/uploads/family_stories/{unique_filename}"
        
        photo = FamilyStoryPhoto(
            story_id=story_id,
            file_url=file_url,
            file_name=file.filename,
            display_order=max_order + idx
        )
        db.add(photo)
        uploaded_photos.append(photo)
    
    db.commit()
    
    return [
        {
            "id": str(photo.id),
            "story_id": str(photo.story_id),
            "file_url": photo.file_url,
            "file_name": photo.file_name,
            "display_order": photo.display_order,
            "created_at": photo.created_at.isoformat()
        }
        for photo in uploaded_photos
    ]


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story_photo(
    photo_id: str,
    db: Session = Depends(get_db),
):
    """
    관리자용: 일상 공유 사진 삭제
    
    - DB 레코드 삭제
    - 파일 시스템에서 실제 파일 삭제
    """
    photo = db.query(FamilyStoryPhoto).filter(
        FamilyStoryPhoto.id == photo_id
    ).first()
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사진을 찾을 수 없습니다"
        )
    
    # 파일 삭제
    import os
    try:
        file_path = f"app{photo.file_url}"
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        print(f"Failed to delete file {photo.file_url}: {e}")
    
    # DB에서 삭제
    db.delete(photo)
    db.commit()


@router.put("/{story_id}/photos/reorder")
def reorder_story_photos(
    story_id: str,
    photo_orders: List[dict],  # [{"photo_id": "...", "display_order": 0}, ...]
    db: Session = Depends(get_db),
):
    """
    관리자용: 사진 순서 변경
    
    Request Body:
    [
        {"photo_id": "uuid1", "display_order": 0},
        {"photo_id": "uuid2", "display_order": 1},
        ...
    ]
    """
    # Story 존재 확인
    story = db.query(FamilyStory).filter(FamilyStory.id == story_id).first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다"
        )
    
    # 순서 업데이트
    for item in photo_orders:
        photo = db.query(FamilyStoryPhoto).filter(
            FamilyStoryPhoto.id == item["photo_id"],
            FamilyStoryPhoto.story_id == story_id
        ).first()
        
        if photo:
            photo.display_order = item["display_order"]
    
    db.commit()
    
    return {"message": "사진 순서가 업데이트되었습니다"}