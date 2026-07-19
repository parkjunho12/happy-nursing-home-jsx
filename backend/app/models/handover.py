"""인수인계 AI 리포트 이력"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class HandoverReport(Base):
    __tablename__ = "handover_reports"

    id = Column(String, primary_key=True, default=_uuid)
    images = Column(JSON, nullable=True)        # 업로드한 사진 경로 배열
    report = Column(JSON, nullable=True)        # AI 판독 결과(구조화)
    model = Column(String(100), nullable=True)  # 사용한 모델
    author = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
