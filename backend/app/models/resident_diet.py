"""어르신 식이 — 바뀐 순간만 적는다.

지금 무엇을 드시는지는 이 기록에서 계산한다(app/services/diet_state.py).
따로 '현재 값' 칸을 두지 않는 이유는, 두 곳에 적으면 언젠가 어긋나기
때문이다. 어긋나면 주방은 틀린 쪽을 보고 차린다.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Boolean, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class DietChange(Base):
    """식이가 바뀐 한 건.

    이 표에는 입원·외박을 적지 않는다 — 자리 비움은 일정에 있다.
    여기는 '무엇을 드시는가' 만 안다.
    """

    __tablename__ = "resident_diet_changes"
    __table_args__ = (
        Index("ix_diet_resident_date", "resident_id", "effective_date"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    resident_id = Column(String, nullable=False, index=True)
    # 당시 성함 — 어르신 기록이 지워져도 이력은 읽을 수 있게 남긴다
    resident_name = Column(String(100), nullable=True)

    # 이날부터 이 식이로 드신다. 적은 날(created_at)과 다를 수 있다.
    effective_date = Column(String(10), nullable=False, index=True)

    rice = Column(String(10), nullable=True)   # 일반식 · 당뇨식 · 다진식 · 죽 · 미음
    side = Column(String(10), nullable=True)   # 일반찬 · 다진찬 · 갈찬
    tube = Column(Boolean, nullable=False, default=False)   # 경관식 — 밥·반찬을 고르지 않는다

    note = Column(String(200), nullable=True)        # 사유 (예: 삼킴 어려워 죽으로)
    source = Column(String(10), nullable=False, default="manual")   # manual | import

    changed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
