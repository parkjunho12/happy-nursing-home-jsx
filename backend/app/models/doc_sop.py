"""인정서·개장기 갱신 서류 처리 순서 — 고칠 수 있고, 고친 이력이 남는다.

■ 왜 코드에서 빼는가

  이 순서는 코드에 박혀 있었다. 그런데 실제로는 바뀐다 — 복지톡이 다른
  것으로 바뀌거나, 공단 절차가 달라지거나, 원본을 두는 자리가 바뀐다.
  그때마다 배포를 기다려야 하면 결국 종이에 따로 적어 붙이게 되고,
  화면의 것은 틀린 채로 남는다.

■ 왜 이력이 필요한가

  이건 여러 사람이 그대로 따라 하는 절차다. 어느 날 한 줄이 사라졌는데
  누가 왜 지웠는지 모르면, 빠뜨린 것인지 일부러 뺀 것인지 판단할 수 없다.
  고칠 때마다 통째로 남겨 두면 언제든 되돌아가 볼 수 있다.

  줄 단위 차이가 아니라 전문(全文)을 남긴다. 되돌리려면 그때 그 내용이
  통째로 있어야 하고, 이 글은 길어야 스무 줄이라 그래도 된다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Integer, Text, DateTime, Index

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 무엇에 대한 글인가. 지금은 하나뿐이지만, 나중에 다른 안내문도 같은 방식으로
# 담을 수 있게 열쇠를 둔다(예: 퇴소 절차, 입소 준비물).
KEY_RENEWAL_SOP = "renewal_sop"
KEY_RENEWAL_SMS = "renewal_sms"


class DocSop(Base):
    """지금 쓰이는 글 — 열쇠 하나에 한 벌."""

    __tablename__ = "doc_sops"

    key        = Column(String(40), primary_key=True)
    content    = Column(Text, nullable=False, default="")
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class DocSopHistory(Base):
    """고칠 때마다 통째로 한 벌씩.

    바뀌기 '전' 내용을 남긴다 — 지금 것은 DocSop 에 있으므로, 이력에는
    그 전 모습들이 쌓인다. 되돌릴 때 그대로 꺼내 쓴다.
    """

    __tablename__ = "doc_sop_histories"
    __table_args__ = (
        Index("ix_doc_sop_hist_key", "key", "created_at"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    key        = Column(String(40), nullable=False)
    content    = Column(Text, nullable=False, default="")
    # 몇 글자에서 몇 글자가 됐는지 — 목록에서 크기 변화만 봐도 감이 온다
    length     = Column(Integer, nullable=True)
    changed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
