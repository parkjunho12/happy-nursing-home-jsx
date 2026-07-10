"""직원 근로계약·서류제출 관리(HR)."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, JSON
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 서류 항목(키, 라벨) — 프론트/집계 공용
DOC_FIELDS = [
    ("health",    "건강검진"),
    ("criminal",  "범죄경력조회"),
    ("cert",      "자격증 사본"),
    ("resident",  "등본"),
    ("family",    "가족관계증명서"),
    ("id_copy",   "신분증 사본"),
    ("bankbook",  "통장 사본"),
    ("insurance", "건강보험자격득실확인서"),
]


class StaffHrRecord(Base):
    __tablename__ = "staff_hr_records"

    id = Column(String, primary_key=True, default=_uuid)
    seq = Column(Integer, default=0, index=True)          # 순번(표시 순서)
    staff_id = Column(String, nullable=True, index=True)  # LtcStaffMember 연동(직원 관리에서 추가 시)
    active = Column(Boolean, default=True, index=True)    # 퇴사 시 False → 표에서 숨김
    hire_date = Column(String(20), nullable=True)         # 입사일
    name = Column(String(100), nullable=True, index=True)
    position = Column(String(50), nullable=True)          # 직종
    contract_period = Column(Text, nullable=True)         # (구) 근로계약일자 텍스트 — 표시 폴백
    contracts = Column(JSON, nullable=True)               # 근로계약 기간 리스트 [{start,end}]
    contract_written = Column(Boolean, default=False)     # 작성여부
    renewal_date = Column(String(20), nullable=True)      # 재계약일자(없으면 null)
    note = Column(Text, nullable=True)                    # 기타

    # 서류 제출: True=제출, False=미제출, None=미입력
    doc_health = Column(Boolean, nullable=True)
    doc_criminal = Column(Boolean, nullable=True)
    doc_cert = Column(Boolean, nullable=True)
    doc_resident = Column(Boolean, nullable=True)
    doc_family = Column(Boolean, nullable=True)
    doc_id_copy = Column(Boolean, nullable=True)
    doc_bankbook = Column(Boolean, nullable=True)
    doc_insurance = Column(Boolean, nullable=True)
    doc_note = Column(Text, nullable=True)                # 서류 기타

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
