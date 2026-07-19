from sqlalchemy import Column, String, DateTime, Enum, Boolean
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"


class UserPosition(str, enum.Enum):
    대표      = "대표"
    시설장    = "시설장"
    이사      = "이사"
    사회복지사 = "사회복지사"
    간호사    = "간호사"
    간호조무사 = "간호조무사"
    물리치료사 = "물리치료사"
    요양보호사 = "요양보호사"
    요양팀장  = "요양팀장"
    앨범담당  = "앨범담당"


ALLOWED_POSITIONS = [p.value for p in UserPosition]


class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email           = Column(String, unique=True, nullable=False, index=True)
    name            = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(Enum(UserRole), nullable=False, default=UserRole.STAFF)
    position        = Column(
        Enum(*ALLOWED_POSITIONS, name="userposition", create_type=False),
        nullable=True
    )

    handover_access = Column(Boolean, default=False)   # 인수인계 AI 페이지 지정 접근 허용
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
