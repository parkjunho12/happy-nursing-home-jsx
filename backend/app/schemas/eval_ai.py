from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# ── 가이드라인 문서 ──────────────────────────────────────────────────────

class EvalGuidelineOut(BaseModel):
    id: str
    title: str
    filename: Optional[str] = None
    char_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class EvalGuidelineDetailOut(EvalGuidelineOut):
    content: str


class EvalGuidelineCreate(BaseModel):
    title: str
    filename: Optional[str] = None
    content: str


# ── AI 검토 요청 ─────────────────────────────────────────────────────────

class AIReviewRequest(BaseModel):
    guideline_id: str
    domain_id: Optional[str] = None    # 특정 평가영역만 검토 (없으면 전체)
    person_id: Optional[str] = None    # 특정 인물(수급자/직원) 체크리스트만 검토


# ── AI 검토 결과 구조 ────────────────────────────────────────────────────

class ChecklistFinding(BaseModel):
    """체크리스트 1건에 대한 AI 피드백"""
    checklist_id: Optional[str] = None
    title: str
    issue: str                      # 문제점/누락 설명
    severity: str = "medium"        # high | medium | low
    recommendation: str             # 개선 제안


class MissingItem(BaseModel):
    """가이드라인 기준 누락된 체크리스트 항목"""
    indicator_name: str             # 관련 세부지표명
    description: str                # 무엇이 빠졌는지
    suggested_title: str            # 추천 체크리스트 제목
    suggested_frequency: str        # daily/weekly/monthly/... 추천
    severity: str = "medium"


class AIReviewResult(BaseModel):
    """AI 검토 종합 결과"""
    overall_score: int = Field(ge=0, le=100)
    summary: str
    strengths: List[str] = []
    findings: List[ChecklistFinding] = []     # 기존 체크리스트 중 보완 필요 항목
    missing_items: List[MissingItem] = []     # 누락된 항목 제안
    compliance_notes: List[str] = []          # 평가 규정 준수 관련 종합 의견


class AIReviewOut(BaseModel):
    id: int
    guideline_id: Optional[str] = None
    guideline_title: Optional[str] = None
    domain_id: Optional[str] = None
    overall_score: int
    summary: str
    model: Optional[str] = None
    created_at: datetime
    result: AIReviewResult
    model_config = ConfigDict(from_attributes=True)


class AIReviewListOut(BaseModel):
    """이력 목록용 (가벼운 버전)"""
    id: int
    guideline_title: Optional[str] = None
    domain_id: Optional[str] = None
    overall_score: int
    summary: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
