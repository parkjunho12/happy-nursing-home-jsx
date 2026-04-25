from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.photo import Photo
from app.models.resident import Resident
from app.models.user import User
from app.schemas.photo import PhotoResponse
from app.schemas.response import ApiResponse
from app.services.storage import StorageService

router = APIRouter()


def to_photo_dict(obj: Photo) -> dict:
    return PhotoResponse.model_validate(obj).model_dump()


@router.post("/upload", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def upload_photos(
    resident_id: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # 입소자 존재 확인
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    storage_service = StorageService()
    uploaded_photos = []
    
    for file in files:
        # 파일 읽기
        content = await file.read()
        
        # 저장
        file_name, file_url = await storage_service.upload_file(
            content,
            file.filename,
            resident_id
        )
        
        # DB 저장
        photo = Photo(
            resident_id=resident_id,
            file_name=file_name,
            file_url=file_url
        )
        db.add(photo)
        uploaded_photos.append(photo)
    
    db.commit()
    
    # Refresh all
    for photo in uploaded_photos:
        db.refresh(photo)
    
    data = [to_photo_dict(p) for p in uploaded_photos]
    return ApiResponse(success=True, data=data)


@router.delete("/{photo_id}", response_model=ApiResponse)
async def delete_photo(
    photo_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # 파일 삭제
    storage_service = StorageService()
    try:
        await storage_service.delete_file(photo.file_url)
    except Exception as e:
        print(f"File delete warning: {e}")
    
    # DB 삭제
    db.delete(photo)
    db.commit()
    
    return ApiResponse(success=True, message="Photo deleted")