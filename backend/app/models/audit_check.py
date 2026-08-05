"""지도점검 종합 체크리스트 — 점검 회차마다 152항목을 시드해 전 직원이 나눠 준비한다."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class AuditRound(Base):
    __tablename__ = "audit_rounds"

    id         = Column(String, primary_key=True, default=_uuid)
    date       = Column(String(10), nullable=False, index=True)   # 점검일 'YYYY-MM-DD'
    title      = Column(String(100), nullable=True)               # 예: '2026년 하반기 공단 지도점검'
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)


class AuditItem(Base):
    __tablename__ = "audit_items"

    id            = Column(String, primary_key=True, default=_uuid)
    round_id      = Column(String, nullable=False, index=True)
    section       = Column(String(50), nullable=False)
    sub           = Column(String(100), nullable=True)
    title         = Column(String(300), nullable=False)
    order         = Column(Integer, default=0)
    assignee_name = Column(String(100), nullable=True)   # 항목 담당자
    checked       = Column(Boolean, default=False)
    checked_by    = Column(String(100), nullable=True)   # 체크한 사람
    checked_at    = Column(DateTime(timezone=True), nullable=True)
    note          = Column(Text, nullable=True)          # 비고 (해당없음·보완내용)
