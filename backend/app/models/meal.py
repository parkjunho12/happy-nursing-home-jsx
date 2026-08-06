"""주간 식단표 — 엑셀로 만들던 주간메뉴표를 구조화해 화면으로."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class MealWeek(Base):
    __tablename__ = "meal_weeks"

    id         = Column(String, primary_key=True, default=_uuid)
    start      = Column(String(10), unique=True, index=True, nullable=False)  # 주 시작일(월) 'YYYY-MM-DD'
    end        = Column(String(10), nullable=False)
    # { '2026-07-27': {'아침':[...], '간식(오전)':[...], '점심':[...], '간식(오후)':[...], '저녁':[...]} }
    days       = Column(JSON, nullable=True)
    notes      = Column(JSON, nullable=True)   # 원산지 안내 등
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class MealTimeSetting(Base):
    """식사 시간 설정 — 식수 정산의 기준. 외출·외박 시간과 겹치는 끼니를 빼고 세는 근거가 된다."""
    __tablename__ = "meal_time_settings"

    id         = Column(String, primary_key=True, default=_uuid)
    breakfast  = Column(String(5), nullable=True)   # 아침 'HH:MM'
    snack_am   = Column(String(5), nullable=True)   # 아침 간식
    lunch      = Column(String(5), nullable=True)   # 점심
    snack_pm   = Column(String(5), nullable=True)   # 저녁 간식
    dinner     = Column(String(5), nullable=True)   # 저녁
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
