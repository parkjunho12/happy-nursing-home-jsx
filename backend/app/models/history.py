from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class HistoryCategory(str, enum.Enum):
    PROGRAM = "PROGRAM"
    EVENT = "EVENT"
    NEWS = "NEWS"
    VOLUNTEER = "VOLUNTEER"


class History(Base):
    __tablename__ = "history"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, index=True)
    slug = Column(String, unique=True, nullable=False, index=True)
    category = Column(SQLEnum(HistoryCategory), nullable=False, index=True)
    content = Column(Text, nullable=False)
    excerpt = Column(Text, nullable=False)
    is_published = Column(Boolean, nullable=False, default=False, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    view_count = Column(Integer, nullable=False, default=0)
    tags = Column(ARRAY(String), nullable=True, default=list)
    image_url = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())