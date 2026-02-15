from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, Boolean
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class ContactStatus(str, enum.Enum):
    PENDING = "PENDING"
    REPLIED = "REPLIED"
    CLOSED = "CLOSED"


class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    inquiry_type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(SQLEnum(ContactStatus), nullable=False, default=ContactStatus.PENDING, index=True)
    privacy_agreed = Column(Boolean, nullable=False, default=True)
    
    reply = Column(Text, nullable=True)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    replied_by = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())