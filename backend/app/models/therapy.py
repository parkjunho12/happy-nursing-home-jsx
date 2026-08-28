"""치료 프로그램 조 편성 — 조를 짜고, 시간표를 만들고, 그 시간에 부른다.

작업치료사 한 사람이 어르신 예순여덟 분을 매일 볼 수는 없다. 그래서 조로
나눈다. 나와서 앉아 계실 수 있는 분들은 조 활동으로, 누워 계신 분들은 방으로
찾아간다. 조마다 요일과 시각을 정해 두면 그 시간에 방송으로 이름을 부르고
담당 선생님께 알림이 간다.

왜 표를 따로 두는가
  · 수급자에게 이미 group_cognitive/leisure/physical(A·B·C)이 있지만 그건
    다른 용도로 쓰이고 있다. 여기에 얹으면 두 쓰임이 엉킨다.
  · 조는 이름·층·성격(나오는 조/찾아가는 조)을 갖는다. 글자 하나로는 담기지
    않는다.

지키는 것
  · 한 분은 한 조에만 속한다. 두 조에 들어가면 같은 시간에 두 곳에서 부른다.
  · 조를 지워도 어르신은 지우지 않는다. 조원 연결만 끊는다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, Index, UniqueConstraint,
)

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 조의 성격 — 부르는 방식이 달라진다
KIND_GATHER = "gather"   # 프로그램실로 나오시는 조 — 방송으로 부른다
KIND_VISIT = "visit"     # 누워 계셔서 방으로 찾아가는 조 — 부르지 않고 알림만
KINDS = (KIND_GATHER, KIND_VISIT)


class TherapyGroup(Base):
    """조 하나 — 가온조·새롬조처럼."""

    __tablename__ = "therapy_groups"

    id         = Column(String, primary_key=True, default=_uuid)
    name       = Column(String(40), nullable=False)          # '가온조'
    floor      = Column(String(20), nullable=True, index=True)  # '2층'
    kind       = Column(String(10), nullable=False, default=KIND_GATHER)
    # 어떤 분들인지 한 줄 — '상태가 나은 분', '도움이 더 필요한 분'
    note       = Column(String(200), nullable=True)
    # 표에서 눈으로 가르기 위한 색. 화면에서만 쓴다.
    color      = Column(String(20), nullable=True)
    sort       = Column(Integer, nullable=False, default=0)
    active     = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class TherapyGroupMember(Base):
    """조원 — 어르신 한 분이 어느 조에 속하는가.

    resident_id 에 unique 를 건다. 한 분이 두 조에 들어가면 같은 시간에 두
    곳에서 이름을 부르게 된다. 화면에서 막는 것으로는 부족하다 — 두 사람이
    동시에 편성하면 뚫린다. 표에서 막는다.
    """

    __tablename__ = "therapy_group_members"
    __table_args__ = (
        UniqueConstraint("resident_id", name="uq_therapy_member_resident"),
        Index("ix_therapy_member_group", "group_id"),
    )

    id          = Column(String, primary_key=True, default=_uuid)
    group_id    = Column(String, nullable=False)
    resident_id = Column(String, nullable=False)
    sort        = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime(timezone=True), default=now_kst)


class TherapySlot(Base):
    """시간표 한 칸 — 무슨 요일 몇 시에 어느 조를 보는가.

    요일로 둔다. 계획은 '일차'로 짜더라도 방송·알림은 실제 요일에 걸려야
    돌기 때문이다. 화면에서 일차를 요일에 붙이면 여기 요일로 저장된다.
    """

    __tablename__ = "therapy_slots"
    __table_args__ = (
        Index("ix_therapy_slot_day_time", "weekday", "start_time"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    weekday    = Column(Integer, nullable=False)             # 0=월 … 6=일
    start_time = Column(String(5), nullable=False)           # 'HH:MM'
    end_time   = Column(String(5), nullable=True)
    group_id   = Column(String, nullable=False, index=True)
    place      = Column(String(60), nullable=True)           # '3층 프로그램실'
    activity   = Column(String(120), nullable=True)          # '옛 사진으로 기억 되살리기'

    # 이 칸에서 방송을 할지 / 알림을 보낼지. 찾아가는 조는 보통 방송을 끈다 —
    # 누워 계신 분을 불러낼 수는 없고, 방송은 소음이 된다.
    broadcast  = Column(Boolean, nullable=False, default=True)
    notify     = Column(Boolean, nullable=False, default=True)
    # 몇 분 전에 알릴지. 0 이면 정각.
    lead_min   = Column(Integer, nullable=False, default=10)

    active     = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
