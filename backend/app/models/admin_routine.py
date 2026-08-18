"""월간 업무 — 매달 반복되는 일(신고·납부·급여·보고)을 규칙으로 한 번만 등록한다.

규칙(admin_routines) 1건이 매달 1건씩 화면에 뜨고, 완료 여부는 달마다(admin_routine_dones) 따로 남는다.
그래서 이번 달에 뭘 아직 안 했는지가 매달 초기화된 채로 보인다.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, UniqueConstraint

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class AdminRoutine(Base):
    """매달 해야 하는 일 1건의 규칙."""

    __tablename__ = "admin_routines"

    id       = Column(String, primary_key=True, default=_uuid)
    # 이 업무의 주인. 사람마다 자기 것만 보고 관리한다 —
    # 남의 목록에 내 일이 섞이면 아무도 자기 일로 안 본다.
    owner_id = Column(String, nullable=False, index=True)
    title    = Column(String(200), nullable=False)
    # 매월 며칠 — 1~31. 그 달에 없는 날(2월 31일 등)은 조회 시 말일로 당겨 표시한다.
    day      = Column(Integer, nullable=False, default=1)
    category = Column(String(50), nullable=False, default="기타")   # 신고·납부 / 급여 / 보고 / 점검 / 기타
    memo     = Column(Text, nullable=True)                          # 처리 방법·사이트·계정 메모
    sort     = Column(Integer, nullable=False, default=0)
    active   = Column(Boolean, nullable=False, default=True)        # 잠시 안 하는 업무는 지우지 말고 끈다
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class AdminRoutineDone(Base):
    """'이번 달 이 업무는 했다' 기록 — (규칙, YYYY-MM)당 1건."""

    __tablename__ = "admin_routine_dones"
    __table_args__ = (
        UniqueConstraint("routine_id", "period_key", name="uq_admin_routine_period"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    routine_id = Column(String, nullable=False, index=True)
    period_key = Column(String(7), nullable=False, index=True)   # 'YYYY-MM'
    done_date  = Column(String(10), nullable=False)              # 실제 처리한 날 'YYYY-MM-DD'
    done_by    = Column(String(100), nullable=True)
    memo       = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
