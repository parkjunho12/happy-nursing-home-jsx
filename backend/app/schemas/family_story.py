from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID

class FamilyStoryPhotoBase(BaseModel):
    file_url: str
    file_name: str
    display_order: int = 0

class FamilyStoryPhotoResponse(FamilyStoryPhotoBase):
    id: UUID
    story_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

class FamilyStoryBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    story_date: date
    status: str = Field(default='draft', pattern='^(draft|published)$')
    privacy_confirmed: bool = False

class FamilyStoryCreate(FamilyStoryBase):
    resident_id: UUID
    author_id: Optional[UUID] = None

class FamilyStoryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    story_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern='^(draft|published)$')
    privacy_confirmed: Optional[bool] = None

class FamilyStoryResponse(FamilyStoryBase):
    id: UUID
    resident_id: UUID
    resident_name: Optional[str] = None
    author_id: Optional[UUID] = None
    photos: List[FamilyStoryPhotoResponse] = []
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class GuardianLogin(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=4)

class GuardianAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    guardian: dict