from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.resident import Gender, ResidentStatus


class ResidentBase(BaseModel):
    name: str = Field(..., max_length=100)
    birth_date: date
    gender: Gender

    admission_date: date
    room_number: str = Field(..., max_length=20)
    grade: str = Field(..., max_length=10)  # "1"~"5" (string 유지)

    emergency_contact: str = Field(..., max_length=100)
    emergency_phone: str = Field(..., max_length=40)

    status: ResidentStatus = ResidentStatus.ACTIVE
    notes: Optional[str] = None


class ResidentCreate(ResidentBase):
    model_config = ConfigDict(extra="forbid")


class ResidentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None

    admission_date: Optional[date] = None
    room_number: Optional[str] = Field(default=None, max_length=20)
    grade: Optional[str] = Field(default=None, max_length=10)

    emergency_contact: Optional[str] = Field(default=None, max_length=100)
    emergency_phone: Optional[str] = Field(default=None, max_length=40)

    status: Optional[ResidentStatus] = None
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class ResidentResponse(ResidentBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
