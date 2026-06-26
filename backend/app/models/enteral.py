"""경관식(튜브 영양식) 재고 관리 — 종류 + 입출고(반출) 내역"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


def _uuid() -> str:
    return str(uuid.uuid4())


class EnteralProduct(Base):
    """경관식 제품(종류)"""
    __tablename__ = "enteral_products"

    id         = Column(String, primary_key=True, default=_uuid)
    name       = Column(String, nullable=False, index=True)   # 제품명(예: 그린비아, 뉴케어)
    brand      = Column(String, nullable=True)                # 제조사/브랜드
    unit       = Column(String, nullable=True, default="팩")  # 단위(팩/캔/통)
    spec       = Column(String, nullable=True)                # 규격/열량(예: 200ml, 200kcal)
    unit_price = Column(Integer, nullable=True)               # 기본 단가(1단위당, 원)
    memo       = Column(Text, nullable=True)
    is_active  = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class EnteralTransaction(Base):
    """경관식 입출고 내역 (in=입고, out=출고/반출)"""
    __tablename__ = "enteral_transactions"

    id            = Column(String, primary_key=True, default=_uuid)
    product_id    = Column(String, nullable=True, index=True)  # enteral_products.id (soft FK)
    product_name  = Column(String, nullable=False)             # 스냅샷(제품 삭제돼도 내역 유지)
    tx_type       = Column(String, nullable=False, index=True) # 'in' | 'out'
    quantity      = Column(Integer, nullable=False, default=0)
    unit_price    = Column(Integer, nullable=True)            # 거래 단가(1단위당, 원) 스냅샷
    resident_name = Column(String, nullable=True)              # 출고(반출) 대상 어르신
    resident_id   = Column(String, nullable=True)
    tx_date       = Column(String, nullable=False, index=True) # YYYY-MM-DD (거래일)
    note          = Column(Text, nullable=True)
    created_by    = Column(String, nullable=True)              # 작성자 이름
    created_at    = Column(DateTime(timezone=True), default=now_kst, index=True)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
