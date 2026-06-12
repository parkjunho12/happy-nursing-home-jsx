import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import (
    EvalDomain, EvalCategory, EvalSubIndicator,
    ChecklistItem, CompletionRecord, LtcResident, LtcStaffMember,
    EvalSetting,
)
from app.schemas.eval import (
    EvalDomainOut, EvalCategoryOut, EvalSubIndicatorOut,
    EvalSettingOut, EvalSettingUpdate,
)
from app.schemas.response import ApiResponse
from datetime import date

eval_router     = APIRouter()
settings_router = APIRouter()
eval_dash_router = APIRouter()


# ── 평가 지표 ─────────────────────────────────────────────────────────────

@eval_router.get("/domains", response_model=ApiResponse)
def list_domains(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(EvalDomain).order_by(EvalDomain.sort_order).all()
    return ApiResponse(success=True, data=[EvalDomainOut.model_validate(r).model_dump() for r in rows])


@eval_router.get("/categories", response_model=ApiResponse)
def list_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(EvalCategory).order_by(EvalCategory.sort_order).all()
    return ApiResponse(success=True, data=[EvalCategoryOut.model_validate(r).model_dump() for r in rows])


@eval_router.get("/indicators", response_model=ApiResponse)
def list_indicators(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(EvalSubIndicator).order_by(EvalSubIndicator.sort_order).all()

    def _to_dict(ind: EvalSubIndicator) -> dict:
        d = EvalSubIndicatorOut.model_validate(ind).model_dump()
        # evidence_list: DB는 JSON 문자열
        if isinstance(ind.evidence_list, str):
            try:
                d["evidence_list"] = json.loads(ind.evidence_list)
            except Exception:
                d["evidence_list"] = []
        return d

    return ApiResponse(success=True, data=[_to_dict(r) for r in rows])


# ── 설정 ──────────────────────────────────────────────────────────────────

@settings_router.get("", response_model=ApiResponse)
def get_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(EvalSetting).first()
    if not s:
        s = EvalSetting()
        db.add(s)
        db.commit()
        db.refresh(s)
    return ApiResponse(success=True, data=EvalSettingOut.model_validate(s).model_dump())


@settings_router.patch("", response_model=ApiResponse)
def update_settings(
    payload: EvalSettingUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = db.query(EvalSetting).first()
    if not s:
        s = EvalSetting()
        db.add(s)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return ApiResponse(success=True, data=EvalSettingOut.model_validate(s).model_dump())


# ── 대시보드 통계 ──────────────────────────────────────────────────────────

@eval_dash_router.get("/stats", response_model=ApiResponse)
def get_eval_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today_str = date.today().isoformat()

    total = db.query(func.count(ChecklistItem.id)).filter(ChecklistItem.active == True).scalar() or 0
    high_risk = db.query(func.count(ChecklistItem.id)).filter(
        ChecklistItem.active == True, ChecklistItem.risk_level == "high", ChecklistItem.completed == False
    ).scalar() or 0

    # 오늘 완료된 일일 항목
    completed_today = db.query(func.count(CompletionRecord.id)).join(
        ChecklistItem, CompletionRecord.checklist_id == ChecklistItem.id
    ).filter(
        ChecklistItem.frequency == "daily",
        CompletionRecord.period_key == today_str,
    ).scalar() or 0

    total_daily = db.query(func.count(ChecklistItem.id)).filter(
        ChecklistItem.active == True, ChecklistItem.frequency == "daily"
    ).scalar() or 0

    active_residents = db.query(func.count(LtcResident.id)).filter(
        LtcResident.status == "active"
    ).scalar() or 0

    active_staff = db.query(func.count(LtcStaffMember.id)).filter(
        LtcStaffMember.status == "active"
    ).scalar() or 0

    return ApiResponse(success=True, data={
        "totalChecklists":  total,
        "completedToday":   completed_today,
        "totalToday":       total_daily,
        "highRiskCount":    high_risk,
        "completionRate":   round(completed_today / total_daily * 100) if total_daily else 0,
        "activeResidents":  active_residents,
        "activeStaff":      active_staff,
    })
