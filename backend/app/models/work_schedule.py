"""월별 근무표 (근무 스케줄) — 월 단위 JSON 문서로 저장"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, JSON, Integer
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


class WorkScheduleConfig(Base):
    """근무표 전역 설정 — 한 행만 쓴다.

    정산 시작월과 회전 기준일이 코드에 박혀 있으면 해가 바뀔 때
    아무 오류 없이 정산이 어긋난다. 그래서 DB로 뺐다."""
    __tablename__ = "work_schedule_config"

    id = Column(String, primary_key=True, default=_uuid)
    settle_start = Column(String(7), nullable=True)      # 'YYYY-MM' 정산(이월) 시작월
    rotation_anchor = Column(String(10), nullable=True)  # 'YYYY-MM-DD' 주주야야휴휴 0일차
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
