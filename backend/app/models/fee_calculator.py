"""수가(급여) 계산기 — 비공개 원본 스냅샷(스프레드시트) + 월별 시나리오.

ADMIN 전용. 원본 스냅샷은 셀 단위 원문(수식 포함)을 그대로 담아 두는
비공개 자료이므로 공개 저장소(R2)가 아니라 DB 에 둔다.

- fee_calculator_source: 항상 최신 1건만 의미 있다 (싱글턴 취급, PUT 은 upsert).
- fee_calculator_scenarios: 월(YYYY-MM)별로 한 행. 낙관적 잠금(updated_at)으로 동시 수정 충돌을 막는다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON, UniqueConstraint

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class FeeCalculatorSource(Base):
    """원본 스프레드시트 스냅샷 — 비공개. 항상 최신 한 건만 쓴다."""
    __tablename__ = "fee_calculator_source"

    id = Column(String, primary_key=True, default=_uuid)
    # [{name, gid, cells:[{cell, value, formula?}]}] — 시트 단위 원문
    sheets = Column(JSON, nullable=False)
    # 클라이언트가 스냅샷을 뜬 시각(ISO 8601 문자열) — 원본 스프레드시트 기준 시각
    captured_at = Column(String(40), nullable=False)
    source_url = Column(String(1000), nullable=True)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class FeeCalculatorScenario(Base):
    """월별 시나리오 입력값 — 낙관적 잠금(updated_at)으로 동시 편집 충돌을 막는다."""
    __tablename__ = "fee_calculator_scenarios"
    __table_args__ = (UniqueConstraint("month", name="uq_fee_calc_scenario_month"),)

    id = Column(String, primary_key=True, default=_uuid)
    month = Column(String(7), nullable=False, index=True)  # 'YYYY-MM'
    inputs = Column(JSON, nullable=False, default=dict)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
