"""식이가 바뀌면 따라오는 일 — 욕구사정과 급여제공계획서.

■ 왜 따로 적어 두는가

  어르신 식사 형태가 바뀌면 서류도 따라가야 한다. 욕구사정을 다시 하고,
  급여제공계획서에 바뀐 식사 형태를 반영해야 한다. 지도점검에서 보는 것은
  '식이가 바뀐 날'과 '계획서에 반영된 날'이 맞물리는가다.

  그런데 주방에 알리려고 식이를 바꾼 사람과, 서류를 쓰는 사람이 다르다.
  말로 전하면 잊히고, 몇 달 뒤 점검에서야 '언제 바뀐 건데 계획서는 그대로냐'
  가 나온다. 그래서 식이를 바꾸는 순간 할 일을 한 줄 만들어 두고, 끝날
  때까지 대시보드에 띄운다.

■ 무엇을 담는가

  무엇이 무엇으로 바뀌었는지를 그때 값으로 찍어 둔다. 나중에 식이가 또
  바뀌어도 '그때 이 일이 왜 생겼는지'는 남아 있어야 한다.

  한 일에는 누가·언제가 붙는다. 체크만 남기면 몇 달 뒤 '이거 누가 했지'를
  아무도 모른다.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Text, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 할 일 세 가지. 순서대로 한다 — 욕구사정을 하고, 그 결과를 계획서에 넣고,
# 마지막에 「어르신 서류현황」에 작성 일시를 적는다.
#
# 서류현황 기록을 따로 둔 이유: 계획서를 고쳐 놓고 일시를 안 적는 일이 잦다.
# 지도점검에서 보는 것은 그 '일시' 라, 문서만 고치고 끝내면 안 한 것과 같다.
# 화면이 대신 적어 줄 수도 있지만, 문서를 쓰기 전에 눌러 두면 허위 기록이
# 남는다. 사람이 적고, 적었다고 체크하게 한다.
TASKS = ("assess", "plan", "docs")
TASK_LABEL = {
    "assess": "욕구사정 생성",
    "plan": "급여제공계획서 반영",
    "docs": "서류현황에 일시 기록",
}


class DietFollowUp(Base):
    """식이 변경 한 건에 딸린 후속조치."""

    __tablename__ = "diet_followups"
    __table_args__ = (
        Index("ix_diet_fu_open", "done_at", "effective_date"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    # 근거가 된 식이 변경. 그 줄이 지워져도 이 일은 남는다(지운 것과 안 한 것은 다르다).
    change_id = Column(String, nullable=True, index=True)

    resident_id = Column(String, nullable=False, index=True)
    # 당시 성함 — 어르신 기록이 지워져도 무슨 일이었는지 읽을 수 있게
    resident_name = Column(String(100), nullable=True)
    floor = Column(String(20), nullable=True)
    room = Column(String(10), nullable=True)

    effective_date = Column(String(10), nullable=False, index=True)   # 식이가 바뀐 날
    # 그때 값 그대로 — 나중에 또 바뀌어도 '이 일이 왜 생겼는지' 는 남아야 한다
    before_label = Column(String(60), nullable=True)
    after_label = Column(String(60), nullable=True)
    note = Column(String(200), nullable=True)          # 식이 변경 사유

    # 한 일 — 체크만 남기면 몇 달 뒤 누가 했는지 아무도 모른다
    assess_at = Column(DateTime(timezone=True), nullable=True)
    assess_by = Column(String(100), nullable=True)
    plan_at = Column(DateTime(timezone=True), nullable=True)
    plan_by = Column(String(100), nullable=True)
    # 「어르신 서류현황」의 급여제공계획서 일시에 적었는가
    docs_at = Column(DateTime(timezone=True), nullable=True)
    docs_by = Column(String(100), nullable=True)

    # 다 끝났거나 '해당 없음' 으로 접은 시각. 이 값이 있으면 대시보드에서 내려간다.
    done_at = Column(DateTime(timezone=True), nullable=True, index=True)
    done_by = Column(String(100), nullable=True)
    # 왜 접었는지 — '해당 없음' 으로 접은 건은 까닭이 남아야 나중에 따질 수 있다
    skip_reason = Column(Text, nullable=True)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
