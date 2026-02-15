from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ReviewBase(BaseModel):
    author_name: str = Field(..., max_length=100)
    resident_name: Optional[str] = Field(default=None, max_length=100)
    rating: int = Field(..., ge=1, le=5)
    content: str

    is_approved: bool = False
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = Field(default=None, max_length=100)


class ReviewCreate(BaseModel):
    # 보통 공개 후기 작성은 승인정보를 받지 않음 (서버가 승인/거절 처리)
    author_name: str = Field(..., max_length=100)
    resident_name: Optional[str] = Field(default=None, max_length=100)
    rating: int = Field(..., ge=1, le=5)
    content: str

    model_config = ConfigDict(extra="forbid")


class ReviewUpdate(BaseModel):
    # 관리자 수정/검수 용도
    author_name: Optional[str] = Field(default=None, max_length=100)
    resident_name: Optional[str] = Field(default=None, max_length=100)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    content: Optional[str] = None

    is_approved: Optional[bool] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = Field(default=None, max_length=100)

    model_config = ConfigDict(extra="forbid")


class ReviewResponse(ReviewBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
