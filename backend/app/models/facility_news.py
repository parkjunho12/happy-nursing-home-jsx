"""시설소식(가정통신문)."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, Boolean, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))
NEWS_CATEGORIES = ["일반", "행사", "면회", "건강", "식단", "봉사", "긴급", "기타"]


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class FacilityNews(Base):
    __tablename__ = "facility_news"

    id = Column(String, primary_key=True, default=_uuid)
    category = Column(String(20), nullable=False, default="일반", index=True)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)

    is_pinned = Column(Boolean, default=False, index=True)
    is_published = Column(Boolean, default=True, index=True)

    author_id = Column(String, nullable=True)
    author_name = Column(String(100), nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
