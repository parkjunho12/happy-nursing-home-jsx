from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resident_id = Column(String, ForeignKey("residents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    file_name = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    resident = relationship("Resident", backref="photos")