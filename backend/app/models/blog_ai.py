"""블로그 AI 작성 사용 이력"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, Text, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _now_kst():
    return datetime.now(KST)


class BlogAiLog(Base):
    __tablename__ = "blog_ai_logs"

    id        = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id   = Column(String, nullable=True, index=True)
    user_name = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    position  = Column(String, nullable=True)

    title_keyword     = Column(String, nullable=True)
    program_name      = Column(String, nullable=True)
    location          = Column(String, nullable=True)
    activity_date     = Column(String, nullable=True)
    participant_count = Column(String, nullable=True)
    tone              = Column(String, nullable=True)
    photo_count       = Column(Integer, default=0)

    titles           = Column(JSON, nullable=True)   # list[str]
    body             = Column(Text, nullable=True)
    hashtags         = Column(JSON, nullable=True)   # list[str]
    guardian_summary = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now_kst, index=True)
