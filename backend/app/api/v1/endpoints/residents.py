from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.resident import Resident
from app.models.user import User
from app.schemas.resident import ResidentCreate, ResidentUpdate, ResidentResponse
from app.schemas.response import ApiResponse

router = APIRouter()


def to_resident_dict(obj: Resident) -> dict:
    """
    Resident 객체를 dict로 변환
    guardians와 photos 정보를 포함
    """
    base_dict = ResidentResponse.model_validate(obj).model_dump()
    
    # 보호자 정보 추가
    if hasattr(obj, 'guardians'):
        base_dict['guardians'] = [
            {
                'id': g.id,
                'resident_id': g.resident_id,
                'name': g.name,
                'relation': g.relation,
                'phone': g.phone,
                'receive_kakao': g.receive_kakao,
                'is_primary': g.is_primary,
                'created_at': g.created_at.isoformat() if g.created_at else None,
                'updated_at': g.updated_at.isoformat() if g.updated_at else None,
            }
            for g in obj.guardians
        ]
    else:
        base_dict['guardians'] = []
    
    # 사진 정보 추가
    if hasattr(obj, 'photos'):
        base_dict['photos'] = [
            {
                'id': p.id,
                'resident_id': p.resident_id,
                'file_name': p.file_name,
                'file_url': p.file_url,
                'uploaded_at': p.uploaded_at.isoformat() if p.uploaded_at else None,
            }
            for p in obj.photos
        ]
    else:
        base_dict['photos'] = []
    
    # 카운트 정보 추가
    base_dict['_count'] = {
        'guardians': len(base_dict['guardians']),
        'photos': len(base_dict['photos'])
    }
    
    return base_dict


@router.get("", response_model=ApiResponse)
def list_residents(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    입소자 목록 조회
    - 보호자 정보 포함
    - 사진 정보 포함 (최근 10개)
    """
    residents = (
        db.query(Resident)
        .options(
            joinedload(Resident.guardians),
            joinedload(Resident.photos)
        )
        .order_by(Resident.created_at.desc())
        .all()
    )
    
    data = [to_resident_dict(r) for r in residents]
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_resident(
    payload: ResidentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """입소자 생성"""
    resident = Resident(**payload.model_dump())
    db.add(resident)
    db.commit()
    db.refresh(resident)
    
    # 생성 후 관계 데이터 로드
    db.refresh(resident)
    resident = (
        db.query(Resident)
        .options(
            joinedload(Resident.guardians),
            joinedload(Resident.photos)
        )
        .filter(Resident.id == resident.id)
        .first()
    )
    
    return ApiResponse(success=True, data=to_resident_dict(resident))


@router.get("/{resident_id}", response_model=ApiResponse)
def get_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    입소자 상세 조회
    - 보호자 정보 포함
    - 사진 정보 포함
    """
    resident = (
        db.query(Resident)
        .options(
            joinedload(Resident.guardians),
            joinedload(Resident.photos)
        )
        .filter(Resident.id == resident_id)
        .first()
    )
    
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    
    return ApiResponse(success=True, data=to_resident_dict(resident))


@router.put("/{resident_id}", response_model=ApiResponse)
def update_resident(
    resident_id: str,
    payload: ResidentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """입소자 수정"""
    resident = (
        db.query(Resident)
        .options(
            joinedload(Resident.guardians),
            joinedload(Resident.photos)
        )
        .filter(Resident.id == resident_id)
        .first()
    )
    
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    patch = payload.model_dump(exclude_unset=True)
    for key, value in patch.items():
        setattr(resident, key, value)

    resident.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(resident)
    
    return ApiResponse(success=True, data=to_resident_dict(resident))


@router.delete("/{resident_id}", response_model=ApiResponse)
def delete_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """입소자 삭제 (cascade로 보호자/사진도 함께 삭제)"""
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    db.delete(resident)
    db.commit()
    return ApiResponse(success=True, message="Resident deleted")