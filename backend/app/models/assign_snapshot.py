"""담당 어르신 명단의 그날 모습.

■ 왜 이력(로그)으로 되살리지 않는가

  변경 이력은 '누가 어느 칸을 무엇에서 무엇으로 바꿨는지' 를 한 줄씩 남긴다.
  그걸 거꾸로 되감아 그날 명단을 만들 수도 있지만, 그러면

    · 그 사이 입소하신 분은 그날 없어야 하는데 이력에는 안 나온다
    · 퇴소하신 분은 그날 있어야 하는데 지금 명단에 없다
    · 한 번도 안 바뀐 분은 이력에 아예 없다

  세 가지를 다 맞춰야 겨우 맞는 답이 나온다. 하나라도 어긋나면 '그날 누가
  담당이었나' 에 틀린 답을 준다. 그건 사고가 났을 때 책임 소재를 따지는
  질문이라, 틀린 답을 그럴듯하게 내놓는 것이 제일 나쁘다.

  그래서 바뀔 때마다 그날 명단을 통째로 박아 둔다.

■ 하루에 한 장

  하루에 여러 번 바뀌면 덮어쓴다. 그날 탭이 보여주는 것은 '그날 마지막
  모습' 이다 — 퇴근할 때 뽑아 붙였을 종이와 같다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, JSON, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


def today_kst() -> str:
    return now_kst().strftime("%Y-%m-%d")


class AssignSnapshot(Base):
    __tablename__ = "assign_snapshots"
    __table_args__ = (
        Index("ix_assign_snapshot_date", "date", unique=True),
    )

    id   = Column(String, primary_key=True, default=_uuid)
    date = Column(String(10), nullable=False)     # 'YYYY-MM-DD' (한국 날짜)

    # 그날의 명단 전체 — [{resident_id, name, floor, room, care, rehab, note, status}, ...]
    rows = Column(JSON, nullable=False, default=list)
    # 명단과 함께 붙던 메모도 같이 남긴다. 종이에 같이 찍히던 것이라
    # 나중에 그날 종이를 다시 보려면 이것도 있어야 한다.
    memo = Column(String(1000), nullable=True)

    changed_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
