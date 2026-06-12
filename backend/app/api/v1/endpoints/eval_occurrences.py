"""
ChecklistOccurrence API

기존 /eval/checklists API는 그대로 유지.
새 /eval/occurrences API만 추가.
"""
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import ChecklistItem, ChecklistOccurrence
from app.schemas.occurrence import OccurrenceOut, OccurrenceComplete
from app.schemas.response import ApiResponse
from app.services.occurrence import (
    get_or_create_occurrence,
    backfill_occurrences,
    mark_overdue,
    complete_occurrence,
    uncomplete_occurrence,
    get_occurrences_due_in_range,
    get_period_key,
    get_period_bounds,
    RECURRING_FREQS, EVENT_FREQS,
)
import uuid

router = APIRouter()


def _occ_to_dict(occ: ChecklistOccurrence) -> dict:
    return {
        "id":                occ.id,
        "checklist_item_id": occ.checklist_item_id,
        "period_key":        occ.period_key,
        "frequency":         occ.frequency,
        "scheduled_date":    occ.scheduled_date,
        "due_date":          occ.due_date,
        "status":            occ.status,
        "completed_date":    occ.completed_date,
        "memo":              occ.memo or "",
        "attachment_name":   occ.attachment_name or "",
        "created_at":        occ.created_at,
        "updated_at":        occ.updated_at,
    }


# ── 동기화 ────────────────────────────────────────────────────────────────

@router.post("/sync", response_model=ApiResponse)
def sync_occurrences(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    로그인 시 1회 호출.
    - created_at ~ 오늘까지 누락된 모든 주기 occurrence 채워 넣기 (backfill)
    - pending 중 마감 지난 것 → overdue 처리
    """
    created_count = backfill_occurrences(db)
    overdue_count = mark_overdue(db)
    db.commit()
    return ApiResponse(success=True, data={
        "created": created_count,
        "overdue": overdue_count,
    })


# ── 조회 ──────────────────────────────────────────────────────────────────

@router.get("", response_model=ApiResponse)
def list_occurrences(
    checklist_item_id: Optional[str] = Query(None),
    period_key:        Optional[str] = Query(None),
    status:            Optional[str] = Query(None),   # pending|completed|overdue
    due_from:          Optional[str] = Query(None),   # YYYY-MM-DD
    due_to:            Optional[str] = Query(None),
    person_id:         Optional[str] = Query(None),
    domain_id:         Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        db.query(ChecklistOccurrence)
        .join(ChecklistItem, ChecklistOccurrence.checklist_item_id == ChecklistItem.id)
        .filter(ChecklistItem.active == True)
        .order_by(ChecklistOccurrence.due_date, ChecklistOccurrence.period_key)
    )
    if checklist_item_id:
        q = q.filter(ChecklistOccurrence.checklist_item_id == checklist_item_id)
    if period_key:
        q = q.filter(ChecklistOccurrence.period_key == period_key)
    if status:
        q = q.filter(ChecklistOccurrence.status == status)
    if due_from:
        q = q.filter(ChecklistOccurrence.due_date >= due_from)
    if due_to:
        q = q.filter(ChecklistOccurrence.due_date <= due_to)
    if person_id:
        q = q.filter(ChecklistItem.person_id == person_id)
    if domain_id:
        q = q.filter(ChecklistItem.related_domain_id == domain_id)

    occs = q.all()
    return ApiResponse(success=True, data=[_occ_to_dict(o) for o in occs])


@router.get("/today", response_model=ApiResponse)
def get_today_occurrences(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    오늘 해야 할 모든 occurrence.
    - 오늘 due_date인 pending/overdue
    - 과거 미완료(overdue) 전체 포함
    """
    today_str = date.today().isoformat()
    q = (
        db.query(ChecklistOccurrence)
        .join(ChecklistItem, ChecklistOccurrence.checklist_item_id == ChecklistItem.id)
        .filter(ChecklistItem.active == True)
        .filter(ChecklistOccurrence.status.in_(['pending', 'overdue']))
        .filter(ChecklistOccurrence.due_date <= today_str)   # 오늘 포함 과거 미완료 전부
        .order_by(ChecklistOccurrence.due_date)
    )
    return ApiResponse(success=True, data=[_occ_to_dict(o) for o in q.all()])


@router.get("/calendar", response_model=ApiResponse)
def get_calendar_occurrences(
    year:  int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """월별 캘린더용 — 해당 월에 due_date 또는 scheduled_date를 가진 occurrence"""
    from calendar import monthrange
    _, last_day = monthrange(year, month)
    start = date(year, month, 1)
    end   = date(year, month, last_day)

    # due_date 또는 scheduled_date가 해당 월에 걸치는 것
    q = (
        db.query(ChecklistOccurrence)
        .join(ChecklistItem, ChecklistOccurrence.checklist_item_id == ChecklistItem.id)
        .filter(ChecklistItem.active == True)
        .filter(
            (ChecklistOccurrence.due_date >= start.isoformat()) |
            (ChecklistOccurrence.status.in_(['pending', 'overdue']))   # 미완료는 항상 포함
        )
        .filter(ChecklistOccurrence.scheduled_date <= end.isoformat())  # 아직 안 끝난 것
        .order_by(ChecklistOccurrence.due_date)
    )
    occs = q.all()

    # 날짜별 그룹핑
    by_date: dict = {}
    today_str = date.today().isoformat()
    for o in occs:
        # 이 occurrence가 표시될 날짜: completed → completed_date, pending/overdue → due_date와 오늘 사이 매일
        if o.status == 'completed':
            key = o.completed_date or o.due_date
            by_date.setdefault(key, []).append(_occ_to_dict(o))
        else:
            # 미완료: scheduled_date ~ min(due_date, today) 사이 매일 표시
            s = date.fromisoformat(o.scheduled_date)
            d_end = min(date.fromisoformat(o.due_date), date.today())
            cur = max(s, start)   # 이번 달 시작부터
            while cur <= min(d_end, end):
                by_date.setdefault(cur.isoformat(), []).append(_occ_to_dict(o))
                cur += timedelta(days=1)

    return ApiResponse(success=True, data=by_date)


@router.get("/{occ_id}", response_model=ApiResponse)
def get_occurrence(occ_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    occ = db.query(ChecklistOccurrence).filter(ChecklistOccurrence.id == occ_id).first()
    if not occ:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=_occ_to_dict(occ))


# ── 완료 / 취소 ───────────────────────────────────────────────────────────

@router.post("/{occ_id}/complete", response_model=ApiResponse)
def complete_occ(
    occ_id: str,
    payload: OccurrenceComplete,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    occ = db.query(ChecklistOccurrence).filter(ChecklistOccurrence.id == occ_id).first()
    if not occ:
        raise HTTPException(404, "Not found")
    occ = complete_occurrence(db, occ, payload.completed_date, payload.memo, payload.attachment_name)

    # ChecklistItem.completed 동기화 (기존 호환)
    _sync_item_completed(db, occ.checklist_item_id)
    db.commit()
    return ApiResponse(success=True, data=_occ_to_dict(occ))


@router.post("/{occ_id}/uncomplete", response_model=ApiResponse)
def uncomplete_occ(
    occ_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    occ = db.query(ChecklistOccurrence).filter(ChecklistOccurrence.id == occ_id).first()
    if not occ:
        raise HTTPException(404, "Not found")
    occ = uncomplete_occurrence(db, occ)

    _sync_item_completed(db, occ.checklist_item_id)
    db.commit()
    return ApiResponse(success=True, data=_occ_to_dict(occ))


# ── 수동 생성 (특정 아이템의 현재 주기 occurrence 즉시 생성) ──────────────

@router.post("/ensure/{item_id}", response_model=ApiResponse)
def ensure_item_occurrence(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """특정 아이템의 누락 occurrence를 채워 넣기 (backfill 단건 버전)"""
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")
    backfill_occurrences(db, item_ids=[item_id])
    mark_overdue(db)
    db.commit()
    # 해당 아이템의 모든 occurrence 반환
    occs = db.query(ChecklistOccurrence).filter(
        ChecklistOccurrence.checklist_item_id == item_id
    ).order_by(ChecklistOccurrence.period_key).all()
    return ApiResponse(success=True, data=[_occ_to_dict(o) for o in occs])


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

def _sync_item_completed(db: Session, item_id: str):
    """
    occurrence 상태 변경 후 ChecklistItem.completed 동기화.
    가장 최근 occurrence가 completed면 item도 completed=True.
    이벤트성은 completed occurrence가 하나라도 있으면 True.
    """
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        return

    if item.frequency in EVENT_FREQS:
        has_completed = db.query(ChecklistOccurrence).filter(
            ChecklistOccurrence.checklist_item_id == item_id,
            ChecklistOccurrence.status == 'completed',
        ).first() is not None
        item.completed      = has_completed
        item.completed_date = db.query(ChecklistOccurrence).filter(
            ChecklistOccurrence.checklist_item_id == item_id,
            ChecklistOccurrence.status == 'completed',
        ).order_by(ChecklistOccurrence.completed_date.desc()).first()
        if item.completed_date:
            item.completed_date = item.completed_date.completed_date
    else:
        # 반복: 현재 주기 occurrence 기준
        today = date.today()
        current_key = get_period_key(item.frequency, today)
        occ = db.query(ChecklistOccurrence).filter(
            ChecklistOccurrence.checklist_item_id == item_id,
            ChecklistOccurrence.period_key == current_key,
        ).first()
        if occ:
            item.completed      = (occ.status == 'completed')
            item.completed_date = occ.completed_date
