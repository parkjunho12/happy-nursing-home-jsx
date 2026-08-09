"""운영·계약 — 업체 계약 대장 + 월별 납부 대장."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base

KST = timezone(timedelta(hours=9))
def now_kst():
    return datetime.now(KST)
def _uuid():
    return str(uuid.uuid4())


class OperationContract(Base):
    """계약 대장 — 만료일 관리가 핵심 (D-90/D-30 갱신 알림)."""
    __tablename__ = "operation_contracts"

    id          = Column(String, primary_key=True, default=_uuid)
    section     = Column(String(20), nullable=False, default="정기")   # 정기·계약·보험·기타·업체·점검
    grp         = Column(String(30), nullable=True)                    # 지출 영역 — 비우면 항목명으로 자동 분류
    category    = Column(String(100), nullable=False)                  # 항목 (소방·전기…)
    vendor      = Column(String(200), nullable=True)                   # 업체명
    contact     = Column(Text, nullable=True)
    amount_note = Column(String(200), nullable=True)                   # 월 지출액 (자유 표기)
    start_date  = Column(String(50), nullable=True)
    end_date    = Column(String(50), nullable=True)
    pay_day     = Column(String(100), nullable=True)                    # 매달 10일 등
    periods     = Column(JSON, nullable=True)                           # 지난 계약 기간 이력 [{start, end, note, recorded_at}]
    memo        = Column(Text, nullable=True)
    active      = Column(Boolean, nullable=False, default=True)
    sort        = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime(timezone=True), default=now_kst)
    updated_at  = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    updated_by  = Column(String(100), nullable=True)


class OperationPayItem(Base):
    """납부 대장의 행 — 항목·업체·입금방법."""
    __tablename__ = "operation_pay_items"

    id       = Column(String, primary_key=True, default=_uuid)
    section  = Column(String(20), nullable=False, default="정기")      # 정기·기타·병원
    category = Column(String(100), nullable=False)
    vendor   = Column(String(200), nullable=True)
    method   = Column(String(100), nullable=True)                      # 자동이체(25일) 등
    grp      = Column(String(30), nullable=True)                       # 지출 영역 (시설·사무·위탁·의료·인건비·광고…)
    sort     = Column(Integer, nullable=False, default=0)
    active   = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)


class OperationPayment(Base):
    """납부 기록 — 한 항목·한 달에 여러 건 가능 (광고비 등)."""
    __tablename__ = "operation_payments"

    id         = Column(String, primary_key=True, default=_uuid)
    item_id    = Column(String, ForeignKey("operation_pay_items.id", ondelete="CASCADE"), nullable=False, index=True)
    year_month = Column(String(7), nullable=False, index=True)         # YYYY-MM
    amount     = Column(Integer, nullable=False, default=0)
    paid_on    = Column(String(20), nullable=True)                     # 납부일 (MM.DD 자유 표기)
    note       = Column(String(200), nullable=True)
    expense_id = Column(String, nullable=True, index=True)             # 지출결의 연동 원본 (중복 가져오기 방지)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
