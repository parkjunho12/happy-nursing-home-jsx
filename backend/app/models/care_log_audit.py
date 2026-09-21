"""주간 급여제공 기록지 점검 (케어포 판정 결과 저장) — 외부 루틴이 올린 스냅샷.

admin 은 저장·조회·표시만 한다(판정 로직은 여기 없다). 같은 week_start 로
다시 올리면 덮어쓴다(upsert) — 그 주의 최신 점검만 의미가 있다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class CareLogAudit(Base):
    __tablename__ = "care_log_audits"

    id = Column(String, primary_key=True, default=_uuid)
    week_start = Column(String(10), unique=True, index=True, nullable=False)
    week_end = Column(String(10), nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(500), nullable=True)
    coverage = Column(JSON, nullable=True)
    summary = Column(JSON, nullable=True)
    findings = Column(JSON, nullable=True)
    staff_workload = Column(JSON, nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
