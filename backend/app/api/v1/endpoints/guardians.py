from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.guardian import Guardian
from app.models.resident import Resident
from app.models.user import User
from app.schemas.guardian import GuardianCreate, GuardianUpdate, GuardianResponse
from app.schemas.response import ApiResponse

router = APIRouter()


def to_guardian_dict(obj: Guardian) -> dict:
    """Guardian 객체를 dict로 변환"""
    result = GuardianResponse.model_validate(obj).model_dump()
    
    # snake_case로 일관성 유지
    if 'residentId' in result:
        result['resident_id'] = result.pop('residentId')
    if 'isPrimary' in result:
        result['is_primary'] = result.pop('isPrimary')
    if 'receiveKakao' in result:
        result['receive_kakao'] = result.pop('receiveKakao')
    if 'createdAt' in result:
        result['created_at'] = result.pop('createdAt')
    if 'updatedAt' in result:
        result['updated_at'] = result.pop('updatedAt')
    
    return result


@router.get("/residents/{resident_id}/guardians", response_model=ApiResponse)
def list_guardians(
    resident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    입소자별 보호자 목록 조회
    - 주 보호자 우선 정렬
    - 생성일 역순 정렬
    """
    # 입소자 존재 확인
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident with id {resident_id} not found"
        )
    
    guardians = (
        db.query(Guardian)
        .filter(Guardian.resident_id == resident_id)
        .order_by(Guardian.is_primary.desc(), Guardian.created_at.desc())
        .all()
    )
    
    data = [to_guardian_dict(g) for g in guardians]
    return ApiResponse(success=True, data=data)


@router.post("/residents/{resident_id}/guardians", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_guardian(
    resident_id: str,
    payload: GuardianCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    보호자 생성
    - 입소자 존재 확인 후 생성
    - 전화번호 중복 체크 (선택사항)
    """
    # 입소자 존재 확인
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident with id {resident_id} not found"
        )
    
    # 선택사항: 동일 입소자의 동일 전화번호 보호자 중복 체크
    existing_guardian = (
        db.query(Guardian)
        .filter(
            Guardian.resident_id == resident_id,
            Guardian.phone == payload.phone
        )
        .first()
    )
    if existing_guardian:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guardian with phone {payload.phone} already exists for this resident"
        )
    
    # 보호자 생성
    guardian = Guardian(resident_id=resident_id, **payload.model_dump())
    db.add(guardian)
    db.commit()
    db.refresh(guardian)
    
    return ApiResponse(success=True, data=to_guardian_dict(guardian))


@router.get("/guardians/{guardian_id}", response_model=ApiResponse)
def get_guardian(
    guardian_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """보호자 상세 조회"""
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id).first()
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardian with id {guardian_id} not found"
        )
    
    return ApiResponse(success=True, data=to_guardian_dict(guardian))


@router.put("/guardians/{guardian_id}", response_model=ApiResponse)
def update_guardian(
    guardian_id: str,
    payload: GuardianUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """보호자 수정"""
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id).first()
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardian with id {guardian_id} not found"
        )
    
    # 업데이트할 필드만 추출
    patch = payload.model_dump(exclude_unset=True)
    
    # 전화번호 변경 시 중복 체크 (선택사항)
    if 'phone' in patch and patch['phone'] != guardian.phone:
        existing = (
            db.query(Guardian)
            .filter(
                Guardian.resident_id == guardian.resident_id,
                Guardian.phone == patch['phone'],
                Guardian.id != guardian_id
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another guardian with phone {patch['phone']} already exists for this resident"
            )
    
    # 필드 업데이트
    for key, value in patch.items():
        setattr(guardian, key, value)
    
    guardian.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(guardian)
    
    return ApiResponse(success=True, data=to_guardian_dict(guardian))


@router.patch("/guardians/{guardian_id}", response_model=ApiResponse)
def patch_guardian(
    guardian_id: str,
    payload: GuardianUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    보호자 부분 수정 (PATCH)
    - PUT과 동일하지만 명시적으로 부분 업데이트를 표현
    """
    return update_guardian(guardian_id, payload, db, _)


@router.delete("/guardians/{guardian_id}", response_model=ApiResponse)
def delete_guardian(
    guardian_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    보호자 삭제
    - cascade로 메시지 로그도 함께 삭제됨
    """
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id).first()
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardian with id {guardian_id} not found"
        )
    
    db.delete(guardian)
    db.commit()
    
    return ApiResponse(
        success=True,
        message=f"Guardian {guardian.name} deleted successfully"
    )


@router.post("/guardians/{guardian_id}/toggle-kakao", response_model=ApiResponse)
def toggle_kakao_receive(
    guardian_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    카카오톡 수신 동의 토글
    - 빠른 수신 설정 변경을 위한 편의 엔드포인트
    """
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id).first()
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardian with id {guardian_id} not found"
        )
    
    # 토글
    guardian.receive_kakao = not guardian.receive_kakao
    guardian.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(guardian)
    
    return ApiResponse(
        success=True,
        data=to_guardian_dict(guardian),
        message=f"Kakao receive status set to {guardian.receive_kakao}"
    )


@router.post("/guardians/{guardian_id}/set-primary", response_model=ApiResponse)
def set_primary_guardian(
    guardian_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    주 보호자로 설정
    - 같은 입소자의 다른 보호자는 자동으로 주 보호자 해제
    """
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id).first()
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Guardian with id {guardian_id} not found"
        )
    
    # 같은 입소자의 다른 보호자들의 주 보호자 해제
    db.query(Guardian).filter(
        Guardian.resident_id == guardian.resident_id,
        Guardian.id != guardian_id
    ).update({"is_primary": False})
    
    # 현재 보호자를 주 보호자로 설정
    guardian.is_primary = True
    guardian.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(guardian)
    
    return ApiResponse(
        success=True,
        data=to_guardian_dict(guardian),
        message=f"{guardian.name} set as primary guardian"
    )