"""낙상·사고 보고서 — 인수인계 메모로 흩어지던 사고를 정식 기록으로.

평가 때 "사고 기록 관리"를 묻고, 보호자 분쟁 때 "언제 알렸는지"를 묻는다.
그래서 사고 자체와 보호자 안내 이력을 한 건에 묶어 남긴다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime, Boolean
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id            = Column(String, primary_key=True, default=_uuid)
    resident_id   = Column(String, nullable=True, index=True)
    resident_name = Column(String(50), nullable=True)
    type          = Column(String(20), nullable=False, index=True)   # 낙상|상처·욕창|투약|발열|식사|행동|기타
    severity      = Column(String(10), default="경미")               # 경미|중등|심각
    occurred_date = Column(String(10), nullable=False, index=True)   # YYYY-MM-DD
    occurred_time = Column(String(5), nullable=True)                 # HH:MM
    location      = Column(String(100), nullable=True)
    description   = Column(Text, nullable=True)      # 무슨 일이 있었나
    action        = Column(Text, nullable=True)      # 즉시 조치
    follow_up     = Column(Text, nullable=True)      # 후속 조치·경과
    # 보호자 안내 이력 — 분쟁 예방의 핵심
    guardian_notified    = Column(Boolean, default=False)
    guardian_notified_at = Column(DateTime(timezone=True), nullable=True)
    guardian_method      = Column(String(20), nullable=True)   # 전화|문자|면회|기타
    guardian_note        = Column(Text, nullable=True)         # 안내 내용·반응
    # open(관찰 중) → closed(종결)
    status        = Column(String(20), default="open", index=True)
    source        = Column(String(20), default="manual")       # manual | handover
    handover_ref  = Column(String(120), nullable=True, unique=True)  # report_id:entry_index (중복 등록 방지)
    reporter_name = Column(String(100), nullable=True)
    created_by    = Column(String, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
