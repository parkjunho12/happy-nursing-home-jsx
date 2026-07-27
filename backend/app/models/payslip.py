"""급여명세서 — 종이 명세서를 사진으로 올리고, 직원이 앱에서 확인·서명한다.

수령 확인 서명이 남으니 "못 받았어요" 분쟁이 없어지고,
관리자는 서명 안 한 사람만 챙기면 된다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class Payslip(Base):
    __tablename__ = "payslips"

    id            = Column(String, primary_key=True, default=_uuid)
    staff_id      = Column(String, nullable=False, index=True)
    staff_name    = Column(String(50), nullable=True)
    year_month    = Column(String(7), nullable=False, index=True)   # 'YYYY-MM'
    image_url     = Column(Text, nullable=False)                    # 명세서 사진 (R2)
    uploaded_by   = Column(String(100), nullable=True)
    # 직원 수령 확인 — 전자서명
    signature_url = Column(Text, nullable=True)
    signed_at     = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
