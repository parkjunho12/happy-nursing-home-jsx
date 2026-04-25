from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MessageSendRequest(BaseModel):
    resident_id: str
    guardian_ids: List[str] = Field(..., min_length=1)
    message_content: str = Field(..., min_length=1)
    photo_urls: List[str] = Field(default_factory=list)
    
    model_config = ConfigDict(extra="forbid")


class MessageLogResponse(BaseModel):
    id: str
    resident_id: str
    guardian_id: str
    message_content: str
    photo_urls: List[str]
    status: str
    error_message: Optional[str] = None
    sent_at: datetime
    
    # Nested data
    resident_name: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)