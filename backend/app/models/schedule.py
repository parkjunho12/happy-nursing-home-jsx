"""통합 일정(방문상담·외부방문·회의·기타 등) — 채용 면접과 별개의 일반 일정"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category      = Column(String, nullable=False, default="기타", index=True)  # 방문상담/외부방문/회의/기타
    title         = Column(String, nullable=False)
    start_at      = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at        = Column(DateTime(timezone=True), nullable=True)
    location      = Column(String, nullable=True)
    contact_name  = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    memo          = Column(Text, nullable=True)
    status        = Column(String, nullable=False, default="scheduled")  # scheduled/done/canceled
    created_by    = Column(String, nullable=True)          # 작성자 이름(표시용)
    created_by_id = Column(String, nullable=True, index=True)  # 작성자 user.id (권한 판정)
    created_at    = Column(DateTime(timezone=True), default=now_kst)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
