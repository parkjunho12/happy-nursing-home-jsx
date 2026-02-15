from pydantic import BaseModel
from typing import Optional, Any


class ApiResponse(BaseModel):
    """Standard API Response"""
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    error: Optional[str] = None