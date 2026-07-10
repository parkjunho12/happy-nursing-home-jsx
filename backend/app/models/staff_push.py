"""직원앱 푸시 토큰."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class StaffPushToken(Base):
    __tablename__ = "staff_push_tokens"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    platform = Column(String, default="android")
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
