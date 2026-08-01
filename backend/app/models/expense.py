"""지출결의(회계 결제 서류) 모델."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 계정과목(카테고리)
EXPENSE_CATEGORIES = [
    "소모품비", "식자재비", "의료용품비", "시설관리비",
    "공과금", "비품구입", "차량유지", "복리후생", "기타",
]
# 결제수단
PAYMENT_METHODS = ["법인카드", "계좌이체", "현금", "개인카드(후정산)"]
# 상태
STATUSES = ["pending", "approved", "rejected"]


class ExpenseRequest(Base):
    __tablename__ = "expense_requests"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String(200), nullable=False)                 # 품목/제목
    amount = Column(Integer, nullable=False, default=0)          # 금액(원)
    vendor = Column(String(200), nullable=True)                 # 거래처
    category = Column(String(50), nullable=False, default="기타", index=True)   # 계정과목
    payment_method = Column(String(50), nullable=True)          # 결제수단
    purchased_at = Column(String(20), nullable=True)            # 구매일 YYYY-MM-DD
    memo = Column(Text, nullable=True)

    # pending(신청) → manager_approved(시설장 1차 승인) → approved(최종) / rejected
    status = Column(String(20), nullable=False, default="pending", index=True)
    reject_reason = Column(Text, nullable=True)

    requester_id = Column(String, nullable=True, index=True)
    requester_name = Column(String(100), nullable=True)
    approver_id = Column(String, nullable=True)
    approver_name = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    manager_id = Column(String, nullable=True)                     # 시설장 1차 승인자
    manager_name = Column(String(100), nullable=True)
    manager_approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)

    attachments = relationship(
        "ExpenseAttachment", back_populates="request",
        cascade="all, delete-orphan", lazy="selectin",
    )


class ExpenseAttachment(Base):
    __tablename__ = "expense_attachments"

    id = Column(String, primary_key=True, default=_uuid)
    request_id = Column(
        String, ForeignKey("expense_requests.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    file_name = Column(String(300), nullable=False)
    file_url = Column(String(500), nullable=False)
    content_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)

    request = relationship("ExpenseRequest", back_populates="attachments")
