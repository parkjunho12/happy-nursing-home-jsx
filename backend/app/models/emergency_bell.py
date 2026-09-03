"""응급벨 명단 — 벨 번호마다 어느 어르신인지.

■ 무엇에 쓰는가

  벨이 울리면 번호만 뜬다. 그 번호가 몇 호실 누구인지 알아야 바로 달려간다.
  그래서 층마다 배치도를 뽑아 벽에 붙인다.

■ 배치는 고정, 이름만 바뀐다

  벨 번호와 방 배치는 설비라서 바뀌지 않는다(공사를 해야 바뀐다).
  바뀌는 것은 그 자리에 누가 계신지뿐이다. 그래서 배치는 마이그레이션으로
  한 번 심어 두고, 화면에서는 이름과 상태만 고친다.

  배치를 화면에서 고치게 두면, 누가 잘못 만졌을 때 벨 번호와 실제 설비가
  어긋난다. 그건 응급 상황에 엉뚱한 방으로 달려가는 일이 된다.

■ 화장실

  두 방이 함께 쓰는 화장실이 있다(공용). 그 벨은 한 방에만 달려 있지만
  두 방 어르신이 다 쓰므로, 배치도에서는 두 방 카드에 모두 보여야 한다.
  어느 방들이 함께 쓰는지는 note 에 적어 둔다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, DateTime, UniqueConstraint, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 벨 자리의 성격
KIND_ROOM = "생활실"
KIND_WC_SHARED = "화장실(공용)"     # 두 방이 함께 쓴다
KIND_WC_PRIVATE = "화장실(전용)"    # 한 방만 쓴다
KIND_WC_FLOOR = "화장실(층 공용)"   # 층 전체가 쓴다
WC_KINDS = (KIND_WC_SHARED, KIND_WC_PRIVATE, KIND_WC_FLOOR)

# 상태 — 비워두면 '아직 안 정한 자리'(배치도에 점선 빈칸으로 나간다)
ST_IN = "재실"
ST_EMPTY = "공실"
STATUSES = (ST_IN, ST_EMPTY)


class EmergencyBell(Base):
    __tablename__ = "emergency_bells"
    __table_args__ = (
        # 같은 층에 같은 번호가 둘이면 어느 방으로 가야 할지 알 수 없다
        UniqueConstraint("floor", "no", name="uq_emergency_bell_floor_no"),
        Index("ix_emergency_bell_floor", "floor"),
    )

    id    = Column(String, primary_key=True, default=_uuid)
    floor = Column(String(10), nullable=False)      # '2층' / '3층'
    no    = Column(Integer, nullable=False)         # 그 층에서의 벨 번호
    room  = Column(String(20), nullable=False)      # '301호' / '공용'
    kind  = Column(String(20), nullable=False)
    note  = Column(String(60), nullable=True)       # '301호 ↔ 302호' 처럼 함께 쓰는 방

    # 여기만 바뀐다
    resident_name = Column(String(60), nullable=True)
    status        = Column(String(10), nullable=True)

    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    updated_by = Column(String(100), nullable=True)
