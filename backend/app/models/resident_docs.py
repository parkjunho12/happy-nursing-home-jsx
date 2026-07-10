"""어르신 서류 현황(장기요양 인정서·계약서·급여제공계획서·평가)."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class ResidentDocStatus(Base):
    __tablename__ = "resident_doc_status"

    id = Column(String, primary_key=True, default=_uuid)
    resident_id = Column(String, nullable=True, index=True)   # LtcResident 연동
    floor = Column(String(20), nullable=True, default="2층")
    seq = Column(Integer, default=0)

    name = Column(String(100), nullable=True, index=True)     # 어르신 성함
    admission_date = Column(String(20), nullable=True)        # 입소일 ISO
    grade = Column(Text, nullable=True)                       # 등급/급여 (예: 4/시설)
    base_date = Column(String(20), nullable=True)             # 기준일(인정서 시작일) ISO

    cert_periods = Column(JSON, nullable=True)                # (legacy) 인정서 기간 flatten [{start,end,type,level}]
    certifications = Column(JSON, nullable=True)             # 인정서 [{grade,cert_no,start,end,benefits:[{type,from}]}]
    contract_lines = Column(JSON, nullable=True)             # 계약서 일시 [문자열]
    plan_lines = Column(JSON, nullable=True)                 # 급여제공계획서 일시 [문자열]
    eval_lines = Column(JSON, nullable=True)                 # 결과평가 일시 [문자열]

    memo = Column(Text, nullable=True)
    active = Column(Boolean, default=True, index=True)        # 퇴소 시 숨김

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
