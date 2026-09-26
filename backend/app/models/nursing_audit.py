"""간호기록 점검 (케어포 3. 간호 급여제공 판정 결과) — 외부 루틴이 올린 월 단위 스냅샷.

admin 은 저장·조회·표시만 한다(판정 로직은 여기 없다). 같은 month(YYYY-MM) 로
다시 올리면 덮어쓴다(upsert). 주별 화면은 월 스냅샷의 findings 를 날짜로 잘라 만든다.
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


class NursingAudit(Base):
    __tablename__ = "nursing_audits"

    id = Column(String, primary_key=True, default=_uuid)
    month = Column(String(7), unique=True, index=True, nullable=False)   # YYYY-MM
    window_start = Column(String(10), nullable=False)
    window_end = Column(String(10), nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(500), nullable=True)
    coverage = Column(JSON, nullable=True)
    summary = Column(JSON, nullable=True)
    findings = Column(JSON, nullable=True)
    home_nursing = Column(JSON, nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
