import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import ChecklistItem, EvalDomain
from app.models.eval_ai import EvalGuideline, EvalAIReview
from app.schemas.eval_ai import (
    EvalGuidelineOut, EvalGuidelineDetailOut, EvalGuidelineCreate,
    AIReviewRequest, AIReviewResult, AIReviewOut, AIReviewListOut,
)
from app.schemas.response import ApiResponse
from app.services.checklist_ai import get_checklist_ai_client

router = APIRouter()

MAX_MD_SIZE = 2 * 1024 * 1024  # 2MB


# ════════════════════════════════════════════════════════════════
# 가이드라인 문서 (.md)
# ════════════════════════════════════════════════════════════════

@router.get("/guidelines", response_model=ApiResponse)
def list_guidelines(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(EvalGuideline).order_by(EvalGuideline.created_at.desc()).all()
    return ApiResponse(success=True, data=[EvalGuidelineOut.model_validate(r).model_dump() for r in rows])


@router.get("/guidelines/{gid}", response_model=ApiResponse)
def get_guideline(gid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    g = db.query(EvalGuideline).filter(EvalGuideline.id == gid).first()
    if not g:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=EvalGuidelineDetailOut.model_validate(g).model_dump())


@router.post("/guidelines", response_model=ApiResponse, status_code=201)
def create_guideline(
    payload: EvalGuidelineCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """텍스트로 직접 등록 (붙여넣기)"""
    if len(payload.content) > MAX_MD_SIZE:
        raise HTTPException(400, "문서가 너무 큽니다 (최대 2MB)")

    g = EvalGuideline(
        title=payload.title,
        filename=payload.filename,
        content=payload.content,
        char_count=len(payload.content),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return ApiResponse(success=True, data=EvalGuidelineOut.model_validate(g).model_dump())


@router.post("/guidelines/upload", response_model=ApiResponse, status_code=201)
async def upload_guideline(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """.md 파일 업로드"""
    if not (file.filename or "").lower().endswith((".md", ".markdown", ".txt")):
        raise HTTPException(400, "마크다운(.md) 또는 텍스트(.txt) 파일만 업로드 가능합니다")

    raw = await file.read()
    if len(raw) > MAX_MD_SIZE:
        raise HTTPException(400, "파일이 너무 큽니다 (최대 2MB)")

    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("utf-8", errors="ignore")

    g = EvalGuideline(
        title=title or file.filename or "평가 가이드라인",
        filename=file.filename,
        content=content,
        char_count=len(content),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return ApiResponse(success=True, data=EvalGuidelineOut.model_validate(g).model_dump())


@router.delete("/guidelines/{gid}", response_model=ApiResponse)
def delete_guideline(gid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    g = db.query(EvalGuideline).filter(EvalGuideline.id == gid).first()
    if not g:
        raise HTTPException(404, "Not found")
    db.delete(g)
    db.commit()
    return ApiResponse(success=True, message="Deleted")


# ════════════════════════════════════════════════════════════════
# AI 검토
# ════════════════════════════════════════════════════════════════

def _checklist_to_summary(item: ChecklistItem) -> dict:
    """AI 프롬프트에 보낼 체크리스트 요약 정보"""
    history = sorted(item.completion_records, key=lambda r: r.period_key)
    return {
        "id": item.id,
        "title": item.title,
        "frequency": item.frequency.value if hasattr(item.frequency, "value") else item.frequency,
        "risk_level": item.risk_level.value if hasattr(item.risk_level, "value") else item.risk_level,
        "assignee": item.assignee,
        "evidence_required": item.evidence_required,
        "related_indicator_id": item.related_indicator_id,
        "related_domain_id": item.related_domain_id,
        "active": item.active,
        "completed": item.completed,
        "recent_completions": [h.period_key for h in history[-6:]],
        "completion_count": len(history),
    }


@router.post("/ai-review", response_model=ApiResponse)
async def run_ai_review(
    payload: AIReviewRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    guideline = db.query(EvalGuideline).filter(EvalGuideline.id == payload.guideline_id).first()
    if not guideline:
        raise HTTPException(404, "가이드라인 문서를 찾을 수 없습니다")

    # 검토 대상 체크리스트 쿼리
    q = db.query(ChecklistItem).options(selectinload(ChecklistItem.completion_records))
    q = q.filter(ChecklistItem.active == True)
    if payload.domain_id:
        q = q.filter(ChecklistItem.related_domain_id == payload.domain_id)
    if payload.person_id:
        q = q.filter(ChecklistItem.person_id == payload.person_id)
    items = q.all()

    if not items:
        raise HTTPException(400, "검토할 체크리스트가 없습니다")

    domain_name = None
    if payload.domain_id:
        domain = db.query(EvalDomain).filter(EvalDomain.id == payload.domain_id).first()
        domain_name = domain.name if domain else None

    summaries = [_checklist_to_summary(i) for i in items]

    client = get_checklist_ai_client()
    result = await client.review(
        guideline_content=guideline.content,
        checklist_items=summaries,
        domain_name=domain_name,
    )

    # 결과 저장 (이력)
    review = EvalAIReview(
        guideline_id=guideline.id,
        guideline_title=guideline.title,
        domain_id=payload.domain_id,
        overall_score=result.overall_score,
        summary=result.summary,
        result_json=result.model_dump_json(),
        model=client.model,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return ApiResponse(success=True, data={
        "id": review.id,
        "guideline_id": review.guideline_id,
        "guideline_title": review.guideline_title,
        "domain_id": review.domain_id,
        "overall_score": review.overall_score,
        "summary": review.summary,
        "model": review.model,
        "created_at": review.created_at,
        "result": result.model_dump(),
    })


@router.get("/ai-reviews", response_model=ApiResponse)
def list_ai_reviews(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(EvalAIReview).order_by(EvalAIReview.created_at.desc()).limit(50).all()
    return ApiResponse(success=True, data=[AIReviewListOut.model_validate(r).model_dump() for r in rows])


@router.get("/ai-reviews/{review_id}", response_model=ApiResponse)
def get_ai_review(review_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(EvalAIReview).filter(EvalAIReview.id == review_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    result = AIReviewResult(**json.loads(r.result_json))
    return ApiResponse(success=True, data={
        "id": r.id,
        "guideline_id": r.guideline_id,
        "guideline_title": r.guideline_title,
        "domain_id": r.domain_id,
        "overall_score": r.overall_score,
        "summary": r.summary,
        "model": r.model,
        "created_at": r.created_at,
        "result": result.model_dump(),
    })


@router.delete("/ai-reviews/{review_id}", response_model=ApiResponse)
def delete_ai_review(review_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(EvalAIReview).filter(EvalAIReview.id == review_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    db.delete(r)
    db.commit()
    return ApiResponse(success=True, message="Deleted")
