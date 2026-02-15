from sqlalchemy import Column, String, DateTime, Date, Enum as SQLEnum
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class StaffStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)  # 간호사, 요양보호사, 영양사, etc
    department = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    hire_date = Column(Date, nullable=False)
    status = Column(SQLEnum(StaffStatus), nullable=False, default=StaffStatus.ACTIVE, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())