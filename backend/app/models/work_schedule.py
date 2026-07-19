"""월별 근무표 (근무 스케줄) — 월 단위 JSON 문서로 저장"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id = Column(String, primary_key=True, default=_uuid)
    year_month = Column(String(7), unique=True, index=True, nullable=False)  # 'YYYY-MM'
    data = Column(JSON, nullable=True)          # { staffId: { day: shiftCode } }
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
