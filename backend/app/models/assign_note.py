"""담당 어르신 명단에 함께 붙는 메모.

어르신 한 분에 대한 이야기가 아니라, 그 명단을 보는 사람들이 다 같이 알아야
하는 것을 적는 자리다 — '이번 주 독감 예방접종', '면회 당분간 제한' 같은.

■ 한 줄만 쓴다

  여럿이 각자 적어 두면 어느 것이 지금 유효한지 알 수 없다. 명단은 벽에
  붙는 문서라, 붙어 있는 종이에 적힌 것이 곧 지금 지침이어야 한다.
  마지막에 고친 사람과 시각을 함께 남겨서, 오래된 내용인지 알 수 있게 한다.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, Integer, Text, String, DateTime

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    return datetime.now(KST)


# 벽에 붙는 종이에 들어갈 만큼만. 길어지면 명단을 밀어내고 아무도 안 읽는다.
NOTE_MAX = 1000


class AssignNote(Base):
    __tablename__ = "assign_notes"

    id         = Column(Integer, primary_key=True, default=1)
    content    = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    updated_by = Column(String(100), nullable=True)
