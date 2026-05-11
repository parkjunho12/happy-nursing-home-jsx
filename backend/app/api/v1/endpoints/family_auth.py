from datetime import timedelta, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.config import settings

from app.models.guardian import Guardian
from app.models.resident import Resident
from app.models.family_story import FamilyStory

router = APIRouter()

# ===== Schemas =====

class GuardianResponse(BaseModel):
    id: str
    name: str
    phone: str
    relation: str
    resident_id: str
    resident_name: str


class GuardianLogin(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20, description="휴대폰 번호")
    password: str = Field(..., min_length=4, description="비밀번호")


class GuardianTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    guardian: GuardianResponse


class GuardianMeResponse(BaseModel):
    id: str
    name: str
    phone: str
    relation: str
    resident: dict


# ===== JWT 설정 =====

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/family/login")


def get_current_guardian(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Guardian:
    """현재 로그인한 보호자 정보 가져오기"""
    import jwt
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        guardian_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if guardian_id is None or token_type != "guardian":
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    guardian = db.query(Guardian).filter(
        Guardian.id == guardian_id,
        Guardian.is_active == True
    ).first()
    
    if not guardian:
        raise credentials_exception
    
    return guardian


# ===== Routes =====

@router.post("/login", response_model=GuardianTokenResponse)
def guardian_login(
    payload: GuardianLogin,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    보호자 로그인
    
    - 휴대폰번호 + 비밀번호 인증
    - JWT 토큰 발급
    - 연결된 어르신 정보 포함
    """
    # 전화번호로 보호자 조회
    guardian = db.query(Guardian).filter(
        Guardian.phone == payload.phone,
        Guardian.is_active == True
    ).first()
    
    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="전화번호 또는 비밀번호가 올바르지 않습니다"
        )
    
    # 비밀번호 검증
    if not guardian.verify_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="전화번호 또는 비밀번호가 올바르지 않습니다"
        )
    
    # 연결된 어르신 정보 가져오기
    resident = db.query(Resident).filter(
        Resident.id == guardian.resident_id
    ).first()
    
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결된 어르신 정보를 찾을 수 없습니다"
        )
    
    # 마지막 로그인 시간 업데이트
    guardian.last_login_at = datetime.utcnow()
    db.commit()
    
    # JWT 토큰 생성
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": guardian.id,
            "phone": guardian.phone,
            "resident_id": guardian.resident_id,
            "type": "guardian"  # User와 구분
        },
        expires_delta=access_token_expires
    )
    
    return GuardianTokenResponse(
        access_token=access_token,
        guardian=GuardianResponse(
            id=guardian.id,
            name=guardian.name,
            phone=guardian.phone,
            relation=guardian.relation,
            resident_id=guardian.resident_id,
            resident_name=resident.name
        )
    )


@router.post("/logout")
def guardian_logout():
    """
    보호자 로그아웃
    
    JWT는 stateless이므로 클라이언트에서 토큰 삭제
    """
    return {
        "success": True,
        "message": "로그아웃되었습니다"
    }


@router.get("/me", response_model=GuardianMeResponse)
def get_guardian_me(
    guardian: Guardian = Depends(get_current_guardian),
    db: Session = Depends(get_db)
):
    """
    현재 로그인한 보호자 정보
    
    - 보호자 기본 정보
    - 연결된 어르신 정보
    """
    # 연결된 어르신 조회
    resident = db.query(Resident).filter(
        Resident.id == guardian.resident_id
    ).first()
    
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결된 어르신 정보를 찾을 수 없습니다"
        )
    
    return GuardianMeResponse(
        id=guardian.id,
        name=guardian.name,
        phone=guardian.phone,
        relation=guardian.relation,
        resident={
            "id": resident.id,
            "name": resident.name,
            "room_number": getattr(resident, 'room_number', ''),
            "birth_date": resident.birth_date.isoformat() if hasattr(resident, 'birth_date') and resident.birth_date else None,
            "admission_date": resident.admission_date.isoformat() if hasattr(resident, 'admission_date') and resident.admission_date else None,
        }
    )


@router.get("/stories")
def get_guardian_stories(
    skip: int = 0,
    limit: int = 100,
    guardian: Guardian = Depends(get_current_guardian),
    db: Session = Depends(get_db)
):
    """
    보호자용: 일상 공유 목록
    
    - 연결된 어르신의 published 상태 글만 조회
    - 최신순 정렬
    """
    # 연결된 어르신의 published 상태 글만 조회
    from sqlalchemy.orm import joinedload
    
    stories = db.query(FamilyStory).options(
        joinedload(FamilyStory.photos)
    ).filter(
        FamilyStory.resident_id == guardian.resident_id,
        FamilyStory.status == 'published'
    ).order_by(
        FamilyStory.story_date.desc()
    ).offset(skip).limit(limit).all()
    
    # 어르신 정보 (캐싱용)
    resident = db.query(Resident).filter(
        Resident.id == guardian.resident_id
    ).first()
    
    result = []
    for story in stories:
        result.append({
            "id": str(story.id),
            "resident_id": str(story.resident_id),
            "resident_name": resident.name if resident else "알 수 없음",
            "title": story.title,
            "content": story.content,
            "story_date": story.story_date.isoformat(),
            "status": story.status,
            "photos": [
                {
                    "id": str(photo.id),
                    "file_url": photo.file_url,
                    "file_name": photo.file_name,
                    "display_order": photo.display_order
                }
                for photo in sorted(story.photos, key=lambda x: x.display_order)
            ],
            "created_at": story.created_at.isoformat()
        })
    
    return result


@router.get("/stories/{story_id}")
def get_guardian_story_detail(
    story_id: str,
    guardian: Guardian = Depends(get_current_guardian),
    db: Session = Depends(get_db)
):
    """
    보호자용: 일상 공유 상세
    
    - 권한 검증: 연결된 어르신의 글인지 확인
    - published 상태만 조회 가능
    """
    from sqlalchemy.orm import joinedload
    
    # 글 조회
    story = db.query(FamilyStory).options(
        joinedload(FamilyStory.photos)
    ).filter(
        FamilyStory.id == story_id,
        FamilyStory.status == 'published'
    ).first()
    
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="게시글을 찾을 수 없습니다"
        )
    
    # 권한 체크: 연결된 어르신의 글인지 확인
    if story.resident_id != guardian.resident_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다"
        )
    
    # 어르신 정보
    resident = db.query(Resident).filter(
        Resident.id == story.resident_id
    ).first()
    
    return {
        "id": str(story.id),
        "resident_id": str(story.resident_id),
        "resident_name": resident.name if resident else "알 수 없음",
        "title": story.title,
        "content": story.content,
        "story_date": story.story_date.isoformat(),
        "photos": [
            {
                "id": str(photo.id),
                "file_url": photo.file_url,
                "file_name": photo.file_name,
                "display_order": photo.display_order
            }
            for photo in sorted(story.photos, key=lambda x: x.display_order)
        ],
        "created_at": story.created_at.isoformat()
    }