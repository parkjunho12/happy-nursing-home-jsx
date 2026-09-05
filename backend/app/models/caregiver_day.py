"""요양보호사 하루 일정 — 근무 유형별 일과표 + 그날만의 일정.

■ 왜 사람×날짜로 두지 않는가

  요양보호사가 스무 명이고 한 달이 서른 날이면 육백 칸이다. 그걸 매달
  손으로 채울 사람은 없다. 안 채워지면 앱을 열어도 빈 화면이고, 빈 화면은
  한 번 보고 다시 안 본다.

  실제로 하루 일과를 가르는 것은 사람이 아니라 '무슨 근무인가' 다.
  주간(D)은 기상 도움으로 시작하고, 야간(N)은 소등과 순회로 흐른다.
  그래서 일과표는 근무 코드별로 한 벌만 만든다. 누가 그날 무슨 근무인지는
  근무표가 이미 알고 있으니, 둘을 맞추면 각자의 하루가 저절로 나온다.

  층마다 다른 일이 있으면 층을 지정한 줄을 더한다. 층이 빈 줄은 모든 층에
  공통으로 들어간다.

■ 그날만의 일정

  '오늘 오전 10시 교육', '오늘 2층 대청소' 같은 것은 일과표에 넣을 수 없다.
  그래서 날짜가 붙은 표를 따로 둔다. 대상은 세 가지로 좁힌다 —
  그 사람만 / 그 층 전체 / 전체. 셋 다 비면 전체다.

  지나간 날의 것은 지우지 않는다. '그날 무엇을 하기로 했는가' 는 나중에
  물어볼 일이 생기는 기록이다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class CaregiverRoutine(Base):
    """근무 코드별 일과표 한 줄 — '06:50 기상·세면 도움'."""

    __tablename__ = "caregiver_routines"
    __table_args__ = (
        Index("ix_cg_routine_shift", "shift_code", "floor"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    # 근무 코드 — 근무표에서 쓰는 것과 같아야 한다 (D·N·AD·PD·M …)
    shift_code = Column(String(10), nullable=False)
    # 층 — 비어 있으면 모든 층 공통
    floor      = Column(String(20), nullable=True)
    start_time = Column(String(5), nullable=False)          # 'HH:MM'
    end_time   = Column(String(5), nullable=True)
    title      = Column(String(80), nullable=False)
    note       = Column(String(200), nullable=True)
    sort       = Column(Integer, nullable=False, default=0)
    active     = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class CaregiverDayTask(Base):
    """그날만의 일정 — 일과표에 없는 것."""

    __tablename__ = "caregiver_day_tasks"
    __table_args__ = (
        Index("ix_cg_day_date", "date"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    date       = Column(String(10), nullable=False)         # 'YYYY-MM-DD'
    # 대상 — 셋 다 비면 전체. 이름도 함께 남긴다(직원이 지워져도 기록은 읽혀야 한다).
    staff_id   = Column(String, nullable=True)
    staff_name = Column(String(100), nullable=True)
    floor      = Column(String(20), nullable=True)
    start_time = Column(String(5), nullable=True)           # 비면 '시간 무관'
    title      = Column(String(80), nullable=False)
    note       = Column(String(200), nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
