"""내보내야 할 문서 — 어르신·보호자에게 교부하거나 기관에 보낼 서류.

■ 왜 체크리스트로 안 되는가

  체크리스트는 '입소할 때 해야 할 일' 처럼 정해진 목록이다. 여기 담기는 것은
  그때그때 생긴다 — 장기요양인정서 갱신이 나왔다, 진단서를 떼 드려야 한다.
  미리 정해 둘 수 없고, 몇 건이 될지도 모른다.

  그리고 이건 '했다/안 했다' 가 아니라 '누구에게 언제 건넸는가' 가 남아야
  하는 일이다. 나중에 "그 서류 받으셨나요" 를 물어올 때 답할 수 있어야 한다.

■ 교부하면 지우지 않는다

  목록에서만 내린다. 줄 자체는 남겨 두고 issued_at 을 채운다. 지우면 언제
  누가 건넸는지가 함께 사라지고, 그게 정확히 나중에 필요해지는 정보다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Text, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


def today_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


class OutgoingDoc(Base):
    """내보내야 할 문서 한 건."""

    __tablename__ = "outgoing_docs"
    __table_args__ = (
        # 아직 안 나간 것부터 찾는다 — 화면이 늘 이 순서로 본다
        Index("ix_outgoing_doc_state", "issued_at", "created_at"),
        Index("ix_outgoing_doc_person", "person_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)

    # 누구 것인가. 어르신이 아닌 것도 있어(시설 대외 문서) 비워 둘 수 있다.
    person_id   = Column(String, nullable=True)
    # 이름도 함께 박아 둔다 — 퇴소하셔도 '그때 누구에게 드렸는지' 는 읽혀야 한다
    person_name = Column(String(100), nullable=True)

    title = Column(String(200), nullable=False)     # '장기요양인정서 갱신 서류'
    note  = Column(Text, nullable=True)             # 덧붙일 말

    # 어디로 나가는가 — 보호자 · 어르신 · 공단 · 병원 …
    target = Column(String(40), nullable=True)
    # 언제까지 — 비워도 된다. 급한 것만 적는다.
    due_date = Column(String(10), nullable=True)

    # 교부 — 채워지면 목록에서 내려간다. 줄은 남는다.
    issued_at = Column(String(10), nullable=True, index=True)   # 'YYYY-MM-DD'
    issued_by = Column(String(100), nullable=True)
    issued_to = Column(String(100), nullable=True)              # 실제로 받으신 분

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)

    @property
    def pending(self) -> bool:
        return not self.issued_at
