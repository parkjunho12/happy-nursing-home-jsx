from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Boolean, Text, Integer, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))
def now_kst(): return datetime.now(KST)


class GuardianAccount(Base):
    __tablename__ = "guardian_accounts"
    id            = Column(String,      primary_key=True)
    name          = Column(String(50),  nullable=False)
    phone         = Column(String(20),  nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    is_active     = Column(Boolean,     default=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst)


class ResidentGuardian(Base):
    __tablename__ = "resident_guardians"
    id          = Column(String, primary_key=True)
    resident_id = Column(String, nullable=False, index=True)
    guardian_id = Column(String, nullable=False, index=True)
    relation    = Column(String(20), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=now_kst)


class Album(Base):
    __tablename__ = "albums"
    id          = Column(String,     primary_key=True)
    resident_id = Column(String,     nullable=False, index=True)
    title       = Column(String(100), nullable=False)
    description = Column(Text,       nullable=True)
    cover_url   = Column(String(500), nullable=True)
    is_public   = Column(Boolean,    default=True)
    created_at  = Column(DateTime(timezone=True), default=now_kst)
    updated_at  = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)  # 마지막 푸시 발송(디바운스)


class AlbumMedia(Base):
    __tablename__ = "album_media"
    id            = Column(String,    primary_key=True)
    album_id      = Column(String,    nullable=False, index=True)
    media_type    = Column(String(10), nullable=False)   # photo | video
    file_url      = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    file_name     = Column(String(255), nullable=True)
    file_size     = Column(Integer,   nullable=True)
    sort_order    = Column(Integer,   default=0)
    status        = Column(String(12), default="approved", index=True)  # approved | pending | rejected
    uploaded_by   = Column(String,    nullable=True)
    approved_by   = Column(String,    nullable=True)
    approved_at   = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst)
