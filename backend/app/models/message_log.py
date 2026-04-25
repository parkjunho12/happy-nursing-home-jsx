from sqlalchemy import Column, String, DateTime, ForeignKey, ARRAY, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
import uuid

from app.core.database import Base


class MessageStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    PENDING = "PENDING"
    FAILED = "FAILED"


class MessageLog(Base):
    __tablename__ = "message_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resident_id = Column(String, ForeignKey("residents.id", ondelete="CASCADE"), nullable=False, index=True)
    guardian_id = Column(String, ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False, index=True)
    
    message_content = Column(Text, nullable=False)
    photo_urls = Column(ARRAY(String), nullable=False, default=list)
    status = Column(String, nullable=False, default=MessageStatus.PENDING.value, index=True)
    error_message = Column(Text, nullable=True)
    
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    resident = relationship("Resident", backref="message_logs")
    guardian = relationship("Guardian", back_populates="message_logs")