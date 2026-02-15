from sqlalchemy import Column, String, DateTime, Date, Enum as SQLEnum, Text
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class ResidentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISCHARGED = "DISCHARGED"
    HOSPITALIZED = "HOSPITALIZED"


class Resident(Base):
    __tablename__ = "residents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    birth_date = Column(Date, nullable=False)
    gender = Column(SQLEnum(Gender), nullable=False)
    admission_date = Column(Date, nullable=False)
    room_number = Column(String, nullable=False, index=True)
    grade = Column(String, nullable=False)  # 1, 2, 3, 4, 5
    emergency_contact = Column(String, nullable=False)
    emergency_phone = Column(String, nullable=False)
    status = Column(SQLEnum(ResidentStatus), nullable=False, default=ResidentStatus.ACTIVE, index=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())