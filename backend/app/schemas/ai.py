from pydantic import BaseModel
from typing import List, Optional, Literal


class AIAnalysisResult(BaseModel):
    """OpenAI 분석 결과"""
    summary: str  # 2~3줄 요약
    category: Literal["입소", "요금", "면회", "의료간호", "프로그램", "기타"]
    urgency: Literal["HIGH", "MEDIUM", "LOW"]
    next_actions: List[str]  # 최대 5개
    red_flags: Optional[List[str]] = None  # 선택적 경고 사항


class ContactAnalysisRequest(BaseModel):
    """상담 분석 요청"""
    name: str
    inquiry_type: str
    message: str
    phone: Optional[str] = None
    email: Optional[str] = None