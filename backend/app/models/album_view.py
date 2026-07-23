"""보호자 앨범 열람 추적."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, DateTime, Index
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def _now_kst() -> datetime:
    return datetime.now(KST)


class FamilyAlbumView(Base):
    __tablename__ = "family_album_views"

    id = Column(String, primary_key=True, default=_uuid)
    guardian_id = Column(String, nullable=False, index=True)
    album_id = Column(String, nullable=False, index=True)
    media_id = Column(String, nullable=True)
    event_type = Column(String(16), nullable=False, default="open")  # open | photo | download
    created_at = Column(DateTime(timezone=True), default=_now_kst, index=True)


Index("ix_fav_album_event", FamilyAlbumView.album_id, FamilyAlbumView.event_type)

