from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PhotoResponse(BaseModel):
    id: str
    resident_id: str
    file_name: str
    file_url: str
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)