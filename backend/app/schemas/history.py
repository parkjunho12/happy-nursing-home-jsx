from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

from app.models.history import HistoryCategory


class HistoryBase(BaseModel):
    title: str = Field(..., max_length=200)
    slug: str = Field(..., max_length=200)
    category: HistoryCategory

    content: str
    excerpt: str

    is_published: bool = False
    published_at: Optional[datetime] = None

    view_count: int = 0
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None


class HistoryCreate(HistoryBase):
    pass


class HistoryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    category: Optional[HistoryCategory] = None

    content: Optional[str] = None
    excerpt: Optional[str] = None

    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None

    view_count: Optional[int] = None
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class HistoryResponse(HistoryBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
