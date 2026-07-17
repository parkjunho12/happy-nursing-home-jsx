"""제공기록지 검수 이력 (DB 저장) — 워커 간 공유·재시작 후에도 유지"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class RecordAudit(Base):
    __tablename__ = "record_audits"

    id = Column(String, primary_key=True, default=_uuid)
    filename = Column(String(300), nullable=True)
    auditor = Column(String(100), nullable=True)
    result = Column(JSON, nullable=True)       # 검수 결과 전체(JSON)
    context = Column(JSON, nullable=True)      # residents_count 등 메타
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
