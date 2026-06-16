from sqlalchemy import Column, String, DateTime, Enum, Boolean
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN   = "ADMIN"    # 원장/대표
    MANAGER = "MANAGER"  # 팀장/사무국장
    STAFF   = "STAFF"    # 일반 직원


class StaffPosition(str, enum.Enum):
    caregiver          = "요양보호사"
    nurse_aide         = "간호(조무)사"
    social_worker      = "사회복지사"
    secretary_general  = "사무국장"
    facility_director  = "시설장"
    ceo                = "대표"
    director           = "이사"
    clerk              = "사무원"


# 프론트에 내려줄 허용 목록
ALLOWED_POSITIONS = [p.value for p in StaffPosition]


class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email           = Column(String, unique=True, nullable=False, index=True)
    name            = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(UserRole), nullable=False, default=UserRole.STAFF)

    # 신규 필드 (마이그레이션 h8... 로 추가)
    position   = Column(String(50),  nullable=True)   # StaffPosition 값
    department = Column(String(50),  nullable=True)
    phone      = Column(String(20),  nullable=True)
    is_active  = Column(Boolean,     default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
