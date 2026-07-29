"""층·호실 설정 — 시설 구조(몇 층, 몇 호실, 몇 침대)를 자유롭게 정의한다.

어르신 등록 때 '어느 방 어느 자리가 비었나'를 침대 그림으로 보여주는 근거 데이터.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class RoomConfig(Base):
    __tablename__ = "room_configs"

    id         = Column(String, primary_key=True, default=_uuid)
    floor      = Column(String(20), nullable=False, index=True)   # '2층'
    room       = Column(String(10), nullable=False)               # '201'
    capacity   = Column(Integer, default=4)                       # 침대 수
    order      = Column(Integer, default=0)
    active     = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
