"""월별 근무표 (근무 스케줄) — 월 단위 JSON 문서로 저장"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON, Integer, Text, UniqueConstraint, Index
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id = Column(String, primary_key=True, default=_uuid)
    year_month = Column(String(7), unique=True, index=True, nullable=False)  # 'YYYY-MM'
    data = Column(JSON, nullable=True)          # { staffId: { day: shiftCode } }
    # 행 구성(직종·조·순서·비고) — 근무표 양식의 왼쪽 고정열
    rows = Column(JSON, nullable=True)          # [{ staff_id, position, team, order, note }]
    base_hours = Column(String(10), nullable=True)   # 기준 근무시간 (기본 160)
    base_days = Column(String(10), nullable=True)    # 기준 근무일수 (기본 20)
    as_of = Column(String(20), nullable=True)        # '( 7월 17일 현재 )' 기준일 ISO
    team_offsets = Column(JSON, nullable=True)      # { 'A조': 2, 'B조': 0, ... } 주주야야휴휴 시작 위치
    notes = Column(JSON, nullable=True)             # { staffId: '한 줄 설명' } — 저장 시 AI가 생성
    # 확정 잠금 — 채워지면 그 달 근무표는 못 바꾼다.
    # 붙여 놓고 나서 조용히 바뀌면 사람마다 다른 표를 보게 된다.
    locked_at = Column(DateTime(timezone=True), nullable=True)
    locked_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class WorkScheduleVersion(Base):
    """근무표 저장 시점 스냅샷 — 편성이 꼬였을 때 되돌리기 위한 이력."""
    __tablename__ = "work_schedule_versions"

    id = Column(String, primary_key=True, default=_uuid)
    year_month = Column(String(7), index=True, nullable=False)
    data = Column(JSON, nullable=True)              # { staffId: { day: code } }
    rows = Column(JSON, nullable=True)              # 직종·조 구성
    base_hours = Column(String(10), nullable=True)
    base_days = Column(String(10), nullable=True)
    as_of = Column(String(20), nullable=True)
    team_offsets = Column(JSON, nullable=True)
    cells = Column(Integer, default=0)              # 입력된 근무 칸 수
    changed = Column(Integer, default=0)            # 직전 저장 대비 바뀐 칸 수
    saved_by = Column(String(100), nullable=True)
    saved_at = Column(DateTime(timezone=True), default=now_kst, index=True)


class WorkScheduleMemo(Base):
    """그 달, 그 선생님에 대한 메모.

    ■ 왜 근무표 문서 안에 넣지 않는가

      근무표의 '비고' 열(rows[].note)이 이미 있지만 거기에 적으면 안 된다.
      조 편성은 이번 달이 비어 있으면 지난달 것을 이어받는다 — 비고도 함께
      따라온다. 8월에 적은 메모가 9월에 그대로 떠 있으면, 읽는 사람은 그것이
      9월 이야기인 줄 안다.

      확정 잠금도 걸린다. 근무표를 확정해 벽에 붙인 뒤에도 사람에 대한 메모는
      계속 생긴다. 메모 한 줄 적으려고 잠금을 풀게 할 수는 없다.

      저장할 때마다 근무표 스냅샷(버전)이 쌓이는 것도 곤란하다. 메모는
      자주 고치는 것이라 되돌리기 이력이 메모로 뒤덮인다.

      그래서 표를 따로 둔다. 근무표의 잠금·버전·수정시각을 건드리지 않는다.

    ■ 벽보에는 나가지 않는다

      사람에 대한 메모다. 근무표는 벽에 붙는 종이라 여기 적은 것을 함께
      내보내면 안 된다. 화면에서만 본다.
    """

    __tablename__ = "work_schedule_memos"
    __table_args__ = (
        # 한 달에 한 사람 한 칸 — 둘이면 어느 것이 그 사람 메모인지 알 수 없다
        UniqueConstraint("year_month", "staff_id", name="uq_ws_memo_month_staff"),
        Index("ix_ws_memo_month", "year_month"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    year_month = Column(String(7), nullable=False)
    staff_id   = Column(String, nullable=False)
    memo       = Column(Text, nullable=False, default="")
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class WorkScheduleConfig(Base):
    """근무표 전역 설정 — 한 행만 쓴다.

    정산 시작월과 회전 기준일이 코드에 박혀 있으면 해가 바뀔 때
    아무 오류 없이 정산이 어긋난다. 그래서 DB로 뺐다."""
    __tablename__ = "work_schedule_config"

    id = Column(String, primary_key=True, default=_uuid)
    settle_start = Column(String(7), nullable=True)      # 'YYYY-MM' 정산(이월) 시작월
    rotation_anchor = Column(String(10), nullable=True)  # 'YYYY-MM-DD' 주주야야휴휴 0일차
    # 근무 코드별 시간 {'N': 10, 'D': 8, …}. 비어 있으면 코드의 기본값을 쓴다.
    #
    # 야간을 9시간으로 볼지 10시간으로 볼지는 시설이 정할 일이고, 실제로
    # 바뀐다. 코드에 박아두면 바꿀 때마다 배포해야 하고, 그동안 급여 계산이
    # 틀린 채로 돈다.
    #
    # 여기 담긴 값은 지난달 총시간까지 함께 바꾼다 — 시점별로 다르게 하려면
    # 달마다 값을 따로 두어야 하는데, 지금은 그럴 만큼 자주 바뀌지 않는다.
    # 바꿀 때 화면이 그 사실을 분명히 알린다.
    code_hours = Column(JSON, nullable=True)
    # 시점별 코드 시간 [{"from": "2026-09", "hours": {"N": 10}}, …]
    #
    # 야간이 9시간에서 10시간으로 바뀌면 바뀐 달부터 그렇게 세야 한다.
    # 하나의 값으로 두면 이미 급여를 지급한 지난달 숫자까지 함께 달라진다.
    # 'from' 이 그 달 이하인 것을 오래된 순서로 덮는다.
    code_hours_rules = Column(JSON, nullable=True)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
