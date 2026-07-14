"""인력배치 시뮬레이터 — 공휴일/제외일 보정용 테이블(음력·대체·관리자 지정)."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, UniqueConstraint
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


class StaffMonthlyHours(Base):
    """직원별 월간 인정근무시간 수동 조정값 (저장형).
    값이 있으면 자동 계산(월 기준시간 ÷ 월 일수 × 재직일수)을 대체한다."""
    __tablename__ = "staff_monthly_hours"
    __table_args__ = (UniqueConstraint("staff_id", "year", "month", name="uq_staff_month_hours"),)

    id = Column(String, primary_key=True, default=_uuid)
    staff_id = Column(String, nullable=False, index=True)   # ltc_staff_members.id
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    hours = Column(Float, nullable=False)
    memo = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
