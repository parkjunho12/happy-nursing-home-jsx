"""
AI 체크리스트 검토 관련 모델
- EvalGuideline: 업로드된 평가 가이드라인 문서 (.md)
- EvalAIReview: AI 검토 결과 이력
"""
from sqlalchemy import Column, String, Integer, Text, DateTime
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class EvalGuideline(Base):
    """평가 가이드라인 문서 (.md 원문 저장)"""
    __tablename__ = "eval_guidelines"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title       = Column(String(200), nullable=False)
    filename    = Column(String(255), nullable=True)
    content     = Column(Text, nullable=False)       # .md 원문 전체
    char_count  = Column(Integer, default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class EvalAIReview(Base):
    """AI 체크리스트 검토 결과 이력"""
    __tablename__ = "eval_ai_reviews"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    guideline_id    = Column(String, nullable=True)   # 참조한 가이드라인 (nullable: 삭제돼도 이력 유지)
    guideline_title = Column(String(200), nullable=True)
    domain_id       = Column(String, nullable=True)   # 특정 평가영역만 검토했을 경우
    overall_score   = Column(Integer, default=0)      # AI가 평가한 종합 점수 (0~100)
    summary         = Column(Text, default="")
    result_json     = Column(Text, nullable=False)    # 전체 AI 응답 JSON (원문 보관)
    model           = Column(String(50), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
