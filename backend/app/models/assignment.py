"""담당 어르신 배정 — 어르신마다 담당 요양팀·재활팀을 정하고 변경 이력을 남긴다.

엑셀 '담당 어르신 명단'을 대체한다: 호실별 명단 자동 생성,
담당별 인원 집계, 변경이 남는 배정.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class ResidentAssignment(Base):
    __tablename__ = "resident_assignments"

    id               = Column(String, primary_key=True, default=_uuid)
    resident_id      = Column(String, nullable=False, unique=True, index=True)
    care_staff_id    = Column(String, nullable=True, index=True)   # 담당 요양팀 (요양보호사)
    care_staff_name  = Column(String(50), nullable=True)
    rehab_staff_id   = Column(String, nullable=True, index=True)   # 담당 재활팀 (물리치료사 등)
    rehab_staff_name = Column(String(50), nullable=True)
    note             = Column(Text, nullable=True)                 # 기타 (예: 7/31 입소)
    updated_by       = Column(String(100), nullable=True)
    updated_at       = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class ResidentAssignmentLog(Base):
    """배정 변경 이력 — 누가 언제 어떤 담당을 바꿨는지."""
    __tablename__ = "resident_assignment_logs"

    id            = Column(String, primary_key=True, default=_uuid)
    resident_id   = Column(String, nullable=False, index=True)
    resident_name = Column(String(50), nullable=True)
    field         = Column(String(20), nullable=False)   # 요양팀 | 재활팀 | 기타 | 호실
    before        = Column(String(100), nullable=True)
    after         = Column(String(100), nullable=True)
    changed_by    = Column(String(100), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst, index=True)
