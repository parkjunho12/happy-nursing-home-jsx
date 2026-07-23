"""보호자 면회 예약 — 전화로 받던 것을 앱 신청으로.

보호자가 날짜·시간을 신청하면 관리자가 승인하고,
승인되면 일정 캘린더의 '면회' 일정으로 자동 등록된다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class VisitReservation(Base):
    __tablename__ = "visit_reservations"

    id            = Column(String, primary_key=True, default=_uuid)
    guardian_id   = Column(String, nullable=False, index=True)
    guardian_name = Column(String(50), nullable=True)      # 당시 이름(비정규화)
    resident_id   = Column(String, nullable=False, index=True)
    resident_name = Column(String(50), nullable=True)
    relation      = Column(String(20), nullable=True)
    date          = Column(String(10), nullable=False, index=True)   # YYYY-MM-DD
    time          = Column(String(5), nullable=False)                # HH:MM
    visitors      = Column(Integer, default=1)                       # 방문 인원
    memo          = Column(Text, nullable=True)
    # pending(승인 대기) → approved | rejected | canceled(보호자 취소)
    status        = Column(String(20), default="pending", index=True)
    reject_reason = Column(Text, nullable=True)
    decided_by    = Column(String(100), nullable=True)
    decided_at    = Column(DateTime(timezone=True), nullable=True)
    schedule_event_id = Column(String, nullable=True)      # 승인 시 생성된 캘린더 일정
    created_at    = Column(DateTime(timezone=True), default=now_kst)
