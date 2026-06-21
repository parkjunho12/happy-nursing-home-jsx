"""보호자 앱 FCM 푸시 토큰"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _now_kst():
    return datetime.now(KST)


class FamilyPushToken(Base):
    __tablename__ = "family_push_tokens"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    guardian_id = Column(String, nullable=False, index=True)
    token       = Column(String, nullable=False, unique=True, index=True)
    platform    = Column(String, default="android")
    created_at  = Column(DateTime(timezone=True), default=_now_kst)
    updated_at  = Column(DateTime(timezone=True), default=_now_kst, onupdate=_now_kst)
