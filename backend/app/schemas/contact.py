from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.contact import ContactStatus  # ✅ SQLAlchemy Enum과 동일 Enum 사용

class ContactReplyRequest(BaseModel):
    reply: str = Field(..., min_length=1)

class ContactStatusUpdateRequest(BaseModel):
    status: ContactStatus

class ContactResponse(BaseModel):
    id: str
    ticket_id: str
    name: str
    phone: str
    email: Optional[str] = None
    inquiry_type: str
    message: str

    status: ContactStatus          # ✅ Literal 말고 Enum
    privacy_agreed: bool

    reply: Optional[str] = None
    replied_at: Optional[datetime] = None
    replied_by: Optional[str] = None

    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
