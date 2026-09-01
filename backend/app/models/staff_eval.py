"""직원 평가(인사고과) — 반기마다 한 번, 관리자만 본다.

■ 왜 따로 두는가

  기존 '평가' 메뉴는 전부 시설 평가(체크리스트·지도점검·제공기록지)다.
  그건 기관이 잘 굴러가는지를 보는 것이고, 이건 사람을 보는 것이다.
  섞으면 권한이 엉킨다 — 시설 평가는 여러 직종이 함께 쓰지만, 인사평가는
  관리자 말고는 아무도 보면 안 된다.

■ 항목을 함께 저장하는 이유

  평가 항목은 언젠가 바뀐다. 그때 점수만 남아 있으면 '3점'이 무엇에 대한
  3점이었는지 알 수 없다. 인사 기록은 몇 년 뒤에 다시 꺼내 보는 것이라,
  그때 무엇을 물었는지가 함께 남아야 한다. 그래서 항목 목록을 그 시점
  그대로 박아 둔다.

■ 한 사람 한 기간에 하나

  (직원, 기간)에 unique 를 건다. 같은 반기에 평가가 둘이면 어느 것이
  맞는지 알 수 없고, 그건 급여나 재계약으로 이어지는 기록이다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, Text, JSON, DateTime, UniqueConstraint, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 평가 항목 — 직종 구분 없이 공통. 각 5점, 합계 30점.
# key 는 바꾸지 않는다. 라벨만 바꾸면 지난 평가는 저장된 라벨로 그대로 보인다.
EVAL_ITEMS = [
    {"key": "attitude", "label": "근무태도 (성실·지각)"},
    {"key": "duty",     "label": "책임감·직무수행"},
    {"key": "teamwork", "label": "동료와의 협업"},
    {"key": "care",     "label": "어르신 응대·태도"},
    {"key": "safety",   "label": "안전·감염관리 준수"},
    {"key": "growth",   "label": "교육 참여·자기계발"},
]
MAX_SCORE = 5
FULL_MARKS = len(EVAL_ITEMS) * MAX_SCORE      # 30


class StaffEvaluation(Base):
    __tablename__ = "staff_evaluations"
    __table_args__ = (
        UniqueConstraint("staff_id", "period", name="uq_staff_eval_staff_period"),
        Index("ix_staff_eval_period", "period"),
    )

    id       = Column(String, primary_key=True, default=_uuid)
    staff_id = Column(String, nullable=False, index=True)   # ltc_staff_members.id
    period   = Column(String(10), nullable=False)           # '2026-H1' / '2026-H2'

    # {"attitude": 4, "duty": 5, ...} — 1~5
    scores   = Column(JSON, nullable=False, default=dict)
    # 평가 당시의 항목 목록과 배점. 나중에 항목이나 배점이 바뀌어도
    # 그때 무엇을 몇 점 만점으로 물었는지가 남는다.
    # 이게 없으면 배점을 5→3 으로 바꾼 순간 지난 평가의 '5점'이 만점을 넘는
    # 이상한 값이 된다.
    items    = Column(JSON, nullable=True)
    max_score = Column(Integer, nullable=True)
    comment  = Column(Text, nullable=True)                  # 총평

    # 누가 매겼는지. 이름을 함께 박아 둔다 — 계정이 지워져도 기록은 남아야 한다.
    evaluator_id   = Column(String, nullable=True)
    evaluator_name = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class StaffEvalConfig(Base):
    """평가 항목·배점 설정 — 한 줄만 쓴다.

    항목은 시설마다 다르고 해마다 바뀐다. 코드에 박아 두면 바꿀 때마다
    배포를 해야 하고, 그러면 결국 안 바꾸게 된다.

    여기 값을 바꿔도 지난 평가는 그대로다. 평가마다 그때의 항목과 배점을
    함께 저장해 두기 때문이다(StaffEvaluation.items / max_score).
    """

    __tablename__ = "staff_eval_config"

    id        = Column(Integer, primary_key=True, default=1)
    items     = Column(JSON, nullable=True)      # [{"key","label"}, ...]
    max_score = Column(Integer, nullable=True)   # 항목당 만점
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    updated_by = Column(String(100), nullable=True)


# 설정에서 허용하는 범위. 넘어서면 표가 읽을 수 없게 된다.
MIN_ITEMS, MAX_ITEMS = 1, 20
MIN_MAX_SCORE, MAX_MAX_SCORE = 2, 10
