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
    ("withholding", "원천징수 동의서"),
    ("subholiday", "대체휴일 합의서"),
    ("compleave", "보상휴가 합의서"),
    ("privacy", "개인정보 동의서"),
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
    doc_withholding = Column(Boolean, nullable=True)     # 원천징수 동의서
    doc_subholiday = Column(Boolean, nullable=True)      # 대체휴일 합의서
    doc_compleave = Column(Boolean, nullable=True)       # 보상휴가 합의서
    doc_privacy = Column(Boolean, nullable=True)         # 개인정보 동의서
    doc_note = Column(Text, nullable=True)                # 서류 기타

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


import calendar as _cal
from datetime import date as _date, timedelta as _td


def to_iso(d):
    """'26.04.01' -> '2026-04-01'; ISO면 그대로; 빈값/X -> None."""
    d = (d or "").strip()
    if not d or d.upper() == "X":
        return None
    if "-" in d and d[:4].isdigit():
        return d
    parts = d.replace("/", ".").split(".")
    if len(parts) == 3:
        y, m, dd = [p.strip() for p in parts]
        if len(y) == 2:
            y = "20" + y
        try:
            return f"{int(y):04d}-{int(m):02d}-{int(dd):02d}"
        except Exception:
            return None
    return None


def minus_one_month(iso):
    try:
        y, m, d = [int(x) for x in iso.split("-")]
    except Exception:
        return None
    m -= 1
    if m < 1:
        m = 12; y -= 1
    d = min(d, _cal.monthrange(y, m)[1])
    return f"{y:04d}-{m:02d}-{d:02d}"


def contract_end_3m(start_iso):
    """입사일(계약 시작) + 3개월 근로계약의 종료일(시작+3개월−1일)."""
    try:
        y, m, d = [int(x) for x in start_iso.split("-")]
    except Exception:
        return None
    m2 = m + 3
    y2 = y + (m2 - 1) // 12
    m2 = (m2 - 1) % 12 + 1
    dd = min(d, _cal.monthrange(y2, m2)[1])
    try:
        return (_date(y2, m2, dd) - _td(days=1)).isoformat()
    except Exception:
        return None


class CardKey(Base):
    """출입 카드키 관리 (카드번호·소지자·보증금·반납 현황)."""
    __tablename__ = "card_keys"

    id = Column(String, primary_key=True, default=_uuid)
    seq = Column(Integer, default=0, index=True)
    card_number = Column(String(50), nullable=True)          # 카드 번호
    holder = Column(String(100), nullable=True, index=True)  # 소지자
    staff_id = Column(String, nullable=True, index=True)     # LtcStaffMember 연동(선택)
    deposit_date = Column(String(20), nullable=True)         # 보증금 납부 일자
    deposit_method = Column(String(50), nullable=True)       # 납부 방법(현금/이체 등)
    deposit_amount = Column(String(30), nullable=True)       # 보증금 액수(선택)
    returned = Column(Boolean, default=False, index=True)    # 반납 여부
    return_date = Column(String(20), nullable=True)          # 반납 일자
    returner = Column(String(100), nullable=True)            # 반납자
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
