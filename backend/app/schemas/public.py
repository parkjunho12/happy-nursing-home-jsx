# app/schemas/public.py
from __future__ import annotations

from datetime import datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, EmailStr, Field, ConfigDict

T = TypeVar("T")

# =========================================================
# Common Response Wrappers (public)
# =========================================================

class PublicApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None


class PublicApiListResponse(BaseModel, Generic[T]):
    success: bool = True
    data: List[T] = Field(default_factory=list)
    message: Optional[str] = None


# =========================================================
# Contact
# =========================================================

class ContactFormRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=40)
    email: Optional[EmailStr] = None
    inquiry_type: str = Field(min_length=1, max_length=50)
    message: str = Field(min_length=1)
    privacy_agreed: bool = True


class ContactFormData(BaseModel):
    """POST /public/contact 응답 data"""
    ticket_id: str


# (선택) 목록/상세가 필요하면 이걸로 확장 가능
class ContactTicketItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: str
    name: str
    phone: str
    email: Optional[str] = None
    inquiry_type: str
    message: str
    privacy_agreed: bool
    status: str
    replied_at: Optional[datetime] = None
    reply: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# =========================================================
# History
# =========================================================

class HistoryListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    category: str
    excerpt: Optional[str] = None
    publishedAt: Optional[datetime] = None


class HistoryDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    content: str
    publishedAt: Optional[datetime] = None


# =========================================================
# Reviews
# =========================================================

class ReviewItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author: str
    rating: int = Field(ge=1, le=5)
    content: str
    date: Optional[str] = None
    verified: bool = False
    featured: bool = False


# =========================================================
# Services / Differentiators
# =========================================================

class ServiceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    icon: str
    title: str
    description: str
    features: List[str] = Field(default_factory=list)


class DifferentiatorItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    icon: str
    title: str
    description: str


# =========================================================
# Public Info
# =========================================================

class PublicInfoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    address: str
    phone: str
    hours: Optional[str] = None
    email: Optional[str] = None
