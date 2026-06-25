"""자원봉사 신청 (MVP)"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, Boolean, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


class VolunteerApplication(Base):
    __tablename__ = "volunteer_applications"

    id                 = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name               = Column(String, nullable=False)
    phone              = Column(String, nullable=False)
    birth_or_age       = Column(String, nullable=True)
    preferred_activity = Column(String, nullable=True)   # 말벗/프로그램 보조/행사 지원/재능기부/기타
    preferred_day      = Column(String, nullable=True)   # 희망 요일(복수 시 콤마)
    preferred_time     = Column(String, nullable=True)
    experience         = Column(Text, nullable=True)     # 봉사 경험
    memo               = Column(Text, nullable=True)     # 신청자 메모
    privacy_agreed     = Column(Boolean, default=False, nullable=False)
    status             = Column(String, default="대기", nullable=False)  # 대기/연락완료/승인/보류
    admin_memo         = Column(Text, nullable=True)
    created_at         = Column(DateTime(timezone=True), default=now_kst)
    updated_at         = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
