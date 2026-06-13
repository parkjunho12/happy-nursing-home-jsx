import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import ChecklistItem, CompletionRecord
from app.schemas.eval import (
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemOut,
    ToggleRequest,
)
from app.schemas.response import ApiResponse
from app.services.occurrence import (
    get_or_create_occurrence, complete_occurrence, uncomplete_occurrence,
)

router = APIRouter()


# ── 응답 변환 헬퍼 ────────────────────────────────────────────────────────

def _cl_to_out(item: ChecklistItem) -> dict:
    # completion_history (기존 CompletionRecord)
    history = [
        {
            "period_key":      r.period_key,
            "completed_date":  r.completed_date,
            "memo":            r.memo or "",
            "attachment_name": r.attachment_name or "",
        }
        for r in sorted(item.completion_records, key=lambda x: x.period_key)
    ]

    # occurrences (신규)
    occs = [
        {
            "id":                o.id,
            "checklist_item_id": o.checklist_item_id,
            "period_key":        o.period_key,
            "frequency":         o.frequency,
            "scheduled_date":    o.scheduled_date,
            "due_date":          o.due_date,
            "status":            o.status,
            "completed_date":    o.completed_date,
            "memo":              o.memo or "",
            "attachment_name":   o.attachment_name or "",
            "created_at":        o.created_at,
            "updated_at":        o.updated_at,
        }
        for o in sorted(item.occurrences, key=lambda x: x.period_key)
    ]

    d = {c.key: getattr(item, c.key) for c in item.__table__.columns}
    d["completion_history"] = history
    d["occurrences"]        = occs
    # due_date는 마이그레이션 전에는 컬럼이 없을 수 있으므로 안전하게 처리
    if "due_date" not in d:
        d["due_date"] = getattr(item, "due_date", None)
    return d


def _query_with_history(db: Session):
    return db.query(ChecklistItem).options(
        selectinload(ChecklistItem.completion_records),
        selectinload(ChecklistItem.occurrences),
    )


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("", response_model=ApiResponse)
def list_checklists(
    frequency: Optional[str] = Query(None),
    person_id: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = _query_with_history(db)
    if active_only:
        q = q.filter(ChecklistItem.active == True)
    if frequency:
        q = q.filter(ChecklistItem.frequency == frequency)
    if person_id:
        q = q.filter(ChecklistItem.person_id == person_id)
    items = q.order_by(ChecklistItem.created_at).all()
    return ApiResponse(success=True, data=[_cl_to_out(i) for i in items])


@router.get("/{item_id}", response_model=ApiResponse)
def get_checklist(item_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=_cl_to_out(item))


@router.post("", response_model=ApiResponse, status_code=201)
def create_checklist(
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = ChecklistItem(
        title=payload.title, description=payload.description,
        frequency=payload.frequency,
        related_indicator_id=payload.related_indicator_id or None,
        related_category_id=payload.related_category_id or None,
        related_domain_id=payload.related_domain_id or None,
        assignee=payload.assignee, evidence_required=payload.evidence_required,
        storage_location=payload.storage_location, how_to=payload.how_to,
        eval_note=payload.eval_note, risk_level=payload.risk_level,
        memo=payload.memo, attachment_name=payload.attachment_name,
        person_id=payload.person_id, person_name=payload.person_name,
        person_type=payload.person_type, template_id=payload.template_id,
        active=True, completed=False,
    )
    db.add(item)
    db.flush()  # id 확보

    # 현재 주기 occurrence 즉시 생성
    get_or_create_occurrence(db, item)

    db.commit()
    item = _query_with_history(db).filter(ChecklistItem.id == item.id).first()
    return ApiResponse(success=True, data=_cl_to_out(item))


@router.post("/bulk", response_model=ApiResponse, status_code=201)
def create_checklists_bulk(
    items: List[ChecklistItemCreate],
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """수급자/직원 등록 시 여러 체크리스트 일괄 생성"""
    new_items = []
    for payload in items:
        item = ChecklistItem(
            title=payload.title, description=payload.description,
            frequency=payload.frequency,
            related_indicator_id=payload.related_indicator_id or None,
            related_category_id=payload.related_category_id or None,
            related_domain_id=payload.related_domain_id or None,
            assignee=payload.assignee, evidence_required=payload.evidence_required,
            storage_location=payload.storage_location, how_to=payload.how_to,
            eval_note=payload.eval_note, risk_level=payload.risk_level,
            memo=payload.memo, attachment_name=payload.attachment_name,
            person_id=payload.person_id, person_name=payload.person_name,
            person_type=payload.person_type, template_id=payload.template_id,
            active=True, completed=False,
        )
        db.add(item)
        new_items.append(item)

    db.flush()  # id 확보

    # 모든 새 아이템의 현재 주기 occurrence 즉시 생성
    for item in new_items:
        get_or_create_occurrence(db, item)

    db.commit()
    ids = [i.id for i in new_items]
    result = _query_with_history(db).filter(ChecklistItem.id.in_(ids)).all()
    return ApiResponse(success=True, data=[_cl_to_out(i) for i in result])


@router.patch("/{item_id}", response_model=ApiResponse)
def update_checklist(
    item_id: str,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(item, field, val)
    db.commit()
    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    return ApiResponse(success=True, data=_cl_to_out(item))


@router.delete("/{item_id}", response_model=ApiResponse)
def delete_checklist(item_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return ApiResponse(success=True, message="Deleted")


@router.post("/{item_id}/toggle", response_model=ApiResponse)
def toggle_complete(
    item_id: str,
    payload: ToggleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    완료/취소 토글.
    period_key와 completed_date는 서버가 KST 기준으로 직접 계산.
    프론트의 시간대에 의존하지 않음.
    """
    from app.services.occurrence import (
        today_kst, get_period_key as _gpk, EVENT_FREQS as _EV,
        ONE_TIME_FREQ,
    )

    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")

    today      = today_kst()
    today_str  = today.isoformat()
    is_event   = item.frequency in _EV
    is_one_time = item.frequency == ONE_TIME_FREQ
    period_key = today_str if is_event else _gpk(item.frequency, today)

    if is_event or is_one_time:
        # ── 이벤트성 / 일회성: boolean 토글 ─────────────────────────────
        item.completed = not item.completed
        item.completed_date = today_str if item.completed else None

        # one_time: period_key = item.due_date (기한 날짜)
        if is_one_time:
            target_date = None
            if hasattr(item, 'due_date') and item.due_date:
                from datetime import date as _date
                target_date = _date.fromisoformat(item.due_date)

        occ = get_or_create_occurrence(db, item, target_date if is_one_time else None)
        if item.completed:
            complete_occurrence(db, occ, today_str, payload.memo, payload.attachment_name)
        else:
            uncomplete_occurrence(db, occ)

    else:
        # ── 반복 주기 ─────────────────────────────────────────────────────
        # 현재 주기 occurrence 찾기 (없으면 생성)
        occ = get_or_create_occurrence(db, item)

        if occ.status == 'completed':
            # 이미 완료 → 취소
            uncomplete_occurrence(db, occ)
            item.completed = False
            item.completed_date = None
            # CompletionRecord도 제거 (기존 호환)
            existing = next(
                (r for r in item.completion_records if r.period_key == period_key), None
            )
            if existing:
                db.delete(existing)
        else:
            # 미완료 → 완료
            complete_occurrence(db, occ, today_str, payload.memo, payload.attachment_name)
            item.completed = True
            item.completed_date = today_str
            # CompletionRecord 추가 (기존 호환, 없을 때만)
            existing = next(
                (r for r in item.completion_records if r.period_key == period_key), None
            )
            if not existing:
                db.add(CompletionRecord(
                    checklist_id=item.id,
                    period_key=period_key,
                    completed_date=today_str,
                    memo=payload.memo,
                    attachment_name=payload.attachment_name,
                ))

    db.commit()
    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    return ApiResponse(success=True, data=_cl_to_out(item))
