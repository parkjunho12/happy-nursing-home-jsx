"""퇴직연금(DC) 적립 관리 — 직원별 월 부담금 발생·은행 입금 대장.

노무 기준: DC형 부담금은 연간 임금총액의 1/12 이상.
월 단위 적립 시 '해당 월 임금 ÷ 12'를 그 달 발생액으로 본다(상여 등은 수동 보정).
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, DateTime, Text, UniqueConstraint

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class PensionEntry(Base):
    __tablename__ = "pension_entries"
    __table_args__ = (UniqueConstraint("staff_id", "month", name="uq_pension_staff_month"),)

    id           = Column(String, primary_key=True, default=_uuid)
    staff_id     = Column(String, nullable=False, index=True)   # LtcStaffMember.id
    month        = Column(String(7), nullable=False, index=True)  # 'YYYY-MM'
    wage         = Column(Integer, nullable=True)               # 해당 월 임금(원)
    accrued      = Column(Integer, nullable=True)               # 발생 부담금(원) — 기본 wage/12, 수정 가능
    deposited    = Column(Integer, nullable=True)               # 은행 입금액(원)
    deposit_date = Column(String(10), nullable=True)            # 입금일 ISO
    memo         = Column(Text, nullable=True)
    updated_by   = Column(String(100), nullable=True)
    updated_at   = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
