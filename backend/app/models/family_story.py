from sqlalchemy import Column, String, Text, Date, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.core.database import Base

class FamilyStory(Base):
    """일상 공유 글"""
    __tablename__ = "family_stories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resident_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    story_date = Column(Date, nullable=False, index=True)
    status = Column(String(20), default='draft', index=True)
    privacy_confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    photos = relationship("FamilyStoryPhoto", back_populates="story", 
                         cascade="all, delete-orphan", 
                         order_by="FamilyStoryPhoto.display_order")

class FamilyStoryPhoto(Base):
    """일상 공유 사진"""
    __tablename__ = "family_story_photos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    story_id = Column(UUID(as_uuid=True), 
                     ForeignKey('family_stories.id', ondelete='CASCADE'), 
                     nullable=False, index=True)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    display_order = Column(Integer, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    story = relationship("FamilyStory", back_populates="photos")