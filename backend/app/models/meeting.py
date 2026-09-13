"""회의 준비 — 카카오톡 대화(txt)로 만든 회의 준비 문서. ADMIN 전용.

원문 대화는 공개 저장소(R2)가 아니라 DB 에 둔다 —
단체 대화 내용이라 URL 만 알면 열리는 곳에 두면 안 된다.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, Text
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class MeetingPrep(Base):
    __tablename__ = "meeting_preps"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String(200), nullable=False)         # 예: 9/15(월) 회의 준비
    content = Column(Text, nullable=False)              # 회의 준비 문서 (일반 텍스트)
    source_name = Column(String(200), nullable=True)    # 올린 txt 파일명
    source_text = Column(Text, nullable=True)           # 카카오톡 대화 원문 — ADMIN 열람용
    model = Column(String(100), nullable=True)
    author_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
