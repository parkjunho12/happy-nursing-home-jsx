"""인력배치 시뮬레이터 — 공휴일/제외일 보정용 테이블(음력·대체·관리자 지정)."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Boolean, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class HolidayCalendar(Base):
    __tablename__ = "holiday_calendar"

    id = Column(String, primary_key=True, default=_uuid)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    name = Column(String(100), nullable=True)
    kind = Column(String(20), nullable=True)               # public/lunar/substitute/custom
    active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
