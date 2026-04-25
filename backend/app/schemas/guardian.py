from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class GuardianBase(BaseModel):
    name: str = Field(..., max_length=100)
    relation: str = Field(..., max_length=50)
    phone: str = Field(..., max_length=40)
    receive_kakao: bool = True
    is_primary: bool = False


class GuardianCreate(GuardianBase):
    model_config = ConfigDict(extra="forbid")


class GuardianUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    relation: Optional[str] = Field(default=None, max_length=50)
    phone: Optional[str] = Field(default=None, max_length=40)
    receive_kakao: Optional[bool] = None
    is_primary: Optional[bool] = None
    
    model_config = ConfigDict(extra="forbid")


class GuardianResponse(GuardianBase):
    id: str
    resident_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)