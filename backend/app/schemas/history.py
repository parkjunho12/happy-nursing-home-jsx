# app/schemas/history.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

from app.models.history import HistoryCategory


class HistoryBase(BaseModel):
    title: str = Field(..., max_length=200)
    slug: str = Field(..., max_length=200)  # ✅ Response에는 계속 필수 유지
    category: HistoryCategory

    content: str
    excerpt: str

    is_published: bool = False
    published_at: Optional[datetime] = None

    view_count: int = 0
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None


class HistoryCreate(HistoryBase):
    # ✅ Create에서는 slug 없어도 되게
    slug: Optional[str] = Field(default=None, max_length=200)

    # (선택) Admin 프론트가 isPublished로 보내면 받게 하고 싶으면 alias 추가
    is_published: bool = Field(default=False, alias="isPublished")
    image_url: Optional[str] = Field(default=None, alias="imageUrl")

    model_config = ConfigDict(populate_by_name=True)


class HistoryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    category: Optional[HistoryCategory] = None

    content: Optional[str] = None
    excerpt: Optional[str] = None

    is_published: Optional[bool] = Field(default=None, alias="isPublished")
    published_at: Optional[datetime] = None

    view_count: Optional[int] = None
    tags: Optional[List[str]] = None
    image_url: Optional[str] = Field(default=None, alias="imageUrl")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class HistoryResponse(HistoryBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)