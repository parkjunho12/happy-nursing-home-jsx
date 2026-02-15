from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_name = Column(String, nullable=False)  # 작성자 이름
    resident_name = Column(String, nullable=True)  # 입소자 이름 (선택)
    rating = Column(Integer, nullable=False)  # 1-5
    content = Column(Text, nullable=False)
    is_approved = Column(Boolean, nullable=False, default=False, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())