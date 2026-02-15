from datetime import datetime
from typing import Optional, Any, List, Dict
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
    
    ai_summary: Optional[str] = None
    ai_category: Optional[str] = None
    ai_urgency: Optional[str] = None
    ai_next_actions: Optional[Any] = None   # JSONB라 Any가 가장 편함 (혹은 List[str])
    ai_model: Optional[str] = None
    ai_created_at: Optional[datetime] = None

    # ✅ 편의 필드
    has_ai_analysis: bool = False

    @classmethod
    def model_validate(cls, obj, **kwargs):
        m = super().model_validate(obj, **kwargs)
        m.has_ai_analysis = bool(getattr(obj, "ai_summary", None))
        return m

    model_config = ConfigDict(from_attributes=True)
