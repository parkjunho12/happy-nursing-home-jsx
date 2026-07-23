"""직원 휴무 신청 — 연차·반차·희망휴무.

지금까지 연차는 관리자에게 말로 전하고 근무표에 손으로 적었다.
신청→승인→근무표 반영을 한 줄로 이어 누락과 "말했는데요"를 없앤다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime, JSON, Boolean
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(String, primary_key=True, default=_uuid)
    staff_id = Column(String, nullable=False, index=True)     # LtcStaffMember.id
    staff_name = Column(String(100), nullable=True)           # 당시 이름(비정규화)
    user_id = Column(String, nullable=True, index=True)       # 신청 계정
    date = Column(String(10), nullable=False, index=True)     # 'YYYY-MM-DD' 하루 = 한 행
    kind = Column(String(20), nullable=False)                 # 연차 | 반차 | 희망휴무
    reason = Column(Text, nullable=True)
    # 희망휴무 전용: 근무표 짤 때 이날을 연차(休)로 우선 반영할지 — 기본 켬
    use_annual = Column(Boolean, nullable=True)
    signature_url = Column(Text, nullable=True)               # 전자서명 이미지 URL
    status = Column(String(20), default="pending", index=True)  # pending|approved|rejected
    decided_by = Column(String(100), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)


class SwapRequest(Base):
    """맞교대 — 직원끼리 합의해 근무를 바꾸는 신청.

    합의의 증빙이 핵심이라 양쪽 모두 전자서명을 남긴다.
    흐름: 신청(A 서명) → 상대 동의(B 서명) → 관리자 승인 → 근무표에서 두 사람 칸 교환.
    """
    __tablename__ = "swap_requests"

    id = Column(String, primary_key=True, default=_uuid)
    requester_staff_id = Column(String, nullable=False, index=True)
    requester_name = Column(String(100), nullable=True)
    requester_user_id = Column(String, nullable=True)
    partner_staff_id = Column(String, nullable=False, index=True)
    partner_name = Column(String(100), nullable=True)
    partner_user_id = Column(String, nullable=True)
    dates = Column(JSON, nullable=False)                 # [내 근무일, 상대 근무일] — 순서 보존
    shift_code = Column(String(20), nullable=True)       # 교환되는 근무 코드(D/N/M…) — 같은 근무끼리만
    reason = Column(Text, nullable=True)
    requester_signature_url = Column(Text, nullable=True)
    partner_signature_url = Column(Text, nullable=True)
    # partner_wait(상대 동의 대기) → pending(관리자 대기) → approved | rejected | declined(상대 거절)
    status = Column(String(20), default="partner_wait", index=True)
    decided_by = Column(String(100), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
