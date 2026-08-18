from sqlalchemy import JSON, Column, String, DateTime, Enum, Boolean
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
    작업치료사 = "작업치료사"   # 물리치료사와 같은 권한 — 재활팀
    요양보호사 = "요양보호사"
    요양팀장  = "요양팀장"
    영양사    = "영양사"
    앨범담당  = "앨범담당"
    외부담당  = "외부담당"


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
    allowed_menus   = Column(JSON, nullable=True)      # 외부담당 전용 — 제공할 메뉴 경로 목록
    saved_signature_url = Column(String, nullable=True)  # 저장해둔 전자서명 — 연차·맞교대 신청에서 재사용
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
