import json
from typing import Optional, List
from pydantic import BaseModel
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
    get_or_create_occurrence, complete_occurrence, uncomplete_occurrence, set_occurrence_progress,
)

router = APIRouter()


# frequency 표기 흔들림 정규화 (예: 'half_yearly' → 'half-yearly')
_FREQ_ALIASES = {
    "half_yearly": "half-yearly",
    "halfyearly": "half-yearly",
    "semiannual": "half-yearly",
    "semi_annual": "half-yearly",
}


def _normalize_freq(freq):
    if not freq:
        return freq
    key = str(freq).strip()
    return _FREQ_ALIASES.get(key, _FREQ_ALIASES.get(key.lower(), key))


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
            "frequency":         _normalize_freq(o.frequency),
            "scheduled_date":    o.scheduled_date,
            "due_date":          o.due_date,
            "status":            o.status,
            "started_by":        getattr(o, "started_by", None),
            "completed_by":      getattr(o, "completed_by", None),
            "completed_date":    o.completed_date,
            "memo":              o.memo or "",
            "attachment_name":   o.attachment_name or "",
            "created_at":        o.created_at,
            "updated_at":        o.updated_at,
        }
        for o in sorted(item.occurrences, key=lambda x: x.period_key)
    ]

    d = {c.key: getattr(item, c.key) for c in item.__table__.columns}
    d["frequency"] = _normalize_freq(d.get("frequency"))
    d["completion_history"] = history
    d["occurrences"]        = occs
    done_occs = [oc for oc in occs if oc["status"] == "completed" and oc.get("completed_by")]
    d["completed_by"] = done_occs[-1]["completed_by"] if done_occs else None
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
    current_user: User = Depends(get_current_user),
):
    q = _query_with_history(db)

    if active_only:
        q = q.filter(ChecklistItem.active == True)

    if frequency:
        q = q.filter(ChecklistItem.frequency == frequency)

    if person_id:
        q = q.filter(ChecklistItem.person_id == person_id)

    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")

    # 핵심: STAFF는 본인에게 배정된 것만 — 시설장은 전체,
    # 사회복지사·간호팀장·물리/작업치료사는 인물(수급자·직원) 연결 항목까지 열람
    if role != "ADMIN" and pos != "시설장":
        if pos in ("사회복지사", "간호팀장", "간호사", "간호조무사", "물리치료사", "작업치료사"):
            from sqlalchemy import or_
            q = q.filter(or_(ChecklistItem.assigned_user_id == current_user.id,
                             ChecklistItem.person_id.isnot(None)))
        else:
            q = q.filter(ChecklistItem.assigned_user_id == current_user.id)

    items = q.order_by(ChecklistItem.created_at).all()

    # occurrence 중복/구식 키 자동 정리 (완료가 미완료로 보이는 문제 방지)
    try:
        from app.services.occurrence import reconcile_occurrences
        changed = 0
        for it in items:
            changed += reconcile_occurrences(db, it)
        if changed:
            db.commit()
            items = q.order_by(ChecklistItem.created_at).all()
    except Exception:
        db.rollback()

    return ApiResponse(
        success=True,
        data=[_cl_to_out(i) for i in items],
    )


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
    current_user: User = Depends(get_current_user),
):
    item = ChecklistItem(
        title=payload.title, description=payload.description,
        frequency=_normalize_freq(payload.frequency),
        related_indicator_id=payload.related_indicator_id or None,
        related_category_id=payload.related_category_id or None,
        related_domain_id=payload.related_domain_id or None,
        assignee=payload.assignee, evidence_required=payload.evidence_required,
        storage_location=payload.storage_location, how_to=payload.how_to,
        eval_note=payload.eval_note, risk_level=payload.risk_level,
        memo=payload.memo, attachment_name=payload.attachment_name,
        person_id=payload.person_id, person_name=payload.person_name,
        person_type=payload.person_type, template_id=payload.template_id,
        recur_weekday=payload.recur_weekday,
        recur_week_of_month=payload.recur_week_of_month,
        recur_day=payload.recur_day,
        recur_due_day=payload.recur_due_day,
        due_date=payload.due_date,
        active=True, completed=False,
    )

    # 담당자 지정 처리
    # - payload.assigned_user_id 가 오면 그 계정으로 지정
    # - 없고 STAFF 가 만든 항목이면 본인에게 자동 배정(본인 목록에 바로 보임)
    # - ADMIN 이 미지정으로 만들면 미배정 상태(이후 담당자 지정 가능)
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    assigned_id = (payload.assigned_user_id or "").strip() or None
    if not assigned_id and role != "ADMIN":
        assigned_id = current_user.id

    if assigned_id:
        assignee_user = db.query(User).filter(User.id == assigned_id).first()
        if not assignee_user:
            raise HTTPException(404, f"담당자 계정을 찾을 수 없습니다: {assigned_id}")
        item.assigned_user_id = assigned_id
        # 담당자 표기(assignee)가 비어 있으면 계정 이름으로 채움
        if not (item.assignee or "").strip():
            item.assignee = assignee_user.name

    db.add(item)
    db.flush()  # id 확보

    # 현재 주기 occurrence 즉시 생성
    get_or_create_occurrence(db, item)

    db.commit()

    # 생성 시 담당자가 본인이 아니면 그 직원에게 푸시
    try:
        if assigned_id and assigned_id != current_user.id:
            from app.services.staff_notify import notify_user
            notify_user(db, assigned_id, "📋 새 업무가 배정되었어요",
                        item.title, data={"type": "checklist", "item_id": item.id})
    except Exception:
        pass

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
            frequency=_normalize_freq(payload.frequency),
            related_indicator_id=payload.related_indicator_id or None,
            related_category_id=payload.related_category_id or None,
            related_domain_id=payload.related_domain_id or None,
            assignee=payload.assignee, evidence_required=payload.evidence_required,
            storage_location=payload.storage_location, how_to=payload.how_to,
            eval_note=payload.eval_note, risk_level=payload.risk_level,
            memo=payload.memo, attachment_name=payload.attachment_name,
            person_id=payload.person_id, person_name=payload.person_name,
            person_type=payload.person_type, template_id=payload.template_id,
            recur_weekday=payload.recur_weekday,
            recur_week_of_month=payload.recur_week_of_month,
            recur_day=payload.recur_day,
            recur_due_day=payload.recur_due_day,
            due_date=payload.due_date,
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
    updates = payload.model_dump(exclude_none=True)
    if updates.get("due_date") == "":   # 빈 문자열 = 기한 해제
        updates["due_date"] = None
    if "frequency" in updates:
        updates["frequency"] = _normalize_freq(updates["frequency"])
    # FK 컬럼은 빈 문자열('')이 FK 제약 위반을 유발 → None 으로 정규화
    _FK_FIELDS = {"related_indicator_id", "related_category_id", "related_domain_id",
                  "assigned_user_id", "person_id"}
    for field, val in list(updates.items()):
        if field in _FK_FIELDS and (val == "" or val is False):
            updates[field] = None
    for field, val in updates.items():
        setattr(item, field, val)
    db.commit()

    # 반복 항목: 반복설정/주기 변경이 현재 주기 occurrence의 예정일/마감일에 반영되도록 갱신
    try:
        from app.services.occurrence import (
            canon_freq, RECURRING_FREQS, ONE_TIME_FREQ, get_or_create_occurrence,
            get_period_bounds, cfg_from_item, today_kst,
        )
        from app.models.eval import ChecklistOccurrence
        fq = canon_freq(item.frequency)
        if fq in RECURRING_FREQS:
            occ = get_or_create_occurrence(db, item)
            if occ.status != 'completed':
                sd, dd = get_period_bounds(fq, today_kst(), cfg_from_item(item))
                occ.scheduled_date = sd.isoformat()
                occ.due_date = dd.isoformat()
                db.commit()
        elif fq == ONE_TIME_FREQ and getattr(item, 'due_date', None):
            # 일회성: 기한 변경을 미완료 occurrence에 반영(화면 표시는 occurrence 기준)
            occs = db.query(ChecklistOccurrence).filter(
                ChecklistOccurrence.checklist_item_id == item.id,
                ChecklistOccurrence.status != 'completed',
            ).all()
            if occs:
                for occ in occs:
                    occ.period_key = item.due_date
                    occ.scheduled_date = item.due_date
                    occ.due_date = item.due_date
            else:
                get_or_create_occurrence(db, item)
            db.commit()
    except Exception:
        db.rollback()

    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    return ApiResponse(success=True, data=_cl_to_out(item))



class AssignBody(BaseModel):
    assigned_user_id: Optional[str] = None


@router.patch("/{item_id}/assign", response_model=ApiResponse)
def assign_checklist(
    item_id: str,
    body: AssignBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """담당자 지정 — ADMIN만 가능"""
    import logging
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "담당자 지정은 관리자만 가능합니다")

    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "항목을 찾을 수 없습니다")

    assigned_user_id = body.assigned_user_id
    logging.warning(f"[ASSIGN] item={item_id!r} assigned_user_id={assigned_user_id!r}")

    if assigned_user_id:
        u = db.query(User).filter(User.id == assigned_user_id).first()
        if not u:
            raise HTTPException(404, f"직원을 찾을 수 없습니다: {assigned_user_id}")
        prev_uid = item.assigned_user_id
        item.assigned_user_id = assigned_user_id
        item.assignee = u.name
        logging.warning(f"[ASSIGN] → user.name={u.name!r} user.id={u.id!r}")
    else:
        prev_uid = item.assigned_user_id
        item.assigned_user_id = None
        item.assignee = ""

    db.commit()

    # 새로 배정된 담당자(본인 제외)에게 푸시
    try:
        if assigned_user_id and assigned_user_id != prev_uid and assigned_user_id != current_user.id:
            from app.services.staff_notify import notify_user
            notify_user(db, assigned_user_id, "📋 새 업무가 배정되었어요",
                        item.title, data={"type": "checklist", "item_id": item.id})
    except Exception:
        pass

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
    current_user: User = Depends(get_current_user),
):
    """
    완료/취소 토글.
    period_key와 completed_date는 서버가 KST 기준으로 직접 계산.
    프론트의 시간대에 의존하지 않음.
    """
    from app.services.occurrence import (
        today_kst, get_period_key as _gpk, EVENT_FREQS as _EV,
        ONE_TIME_FREQ, cfg_from_item,
    )

    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")

    today      = today_kst()
    today_str  = today.isoformat()
    is_event   = item.frequency in _EV
    is_one_time = item.frequency == ONE_TIME_FREQ
    period_key = today_str if is_event else _gpk(item.frequency, today, cfg_from_item(item))

    if is_event or is_one_time:
        # ── 이벤트성 / 일회성 ─────────────────────────────
        desired = payload.completed if payload.completed is not None else (not item.completed)
        item.completed = desired
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
            occ.completed_by = getattr(current_user, "name", None)   # 누가 체크했는지
        else:
            uncomplete_occurrence(db, occ)
            occ.completed_by = None

    else:
        # ── 반복 주기 ─────────────────────────────────────────────────────
        # 옛 키/중복 occurrence 정리 후 현재 주기 occurrence 확보
        try:
            from app.services.occurrence import reconcile_occurrences
            reconcile_occurrences(db, item)
        except Exception:
            pass
        occ = get_or_create_occurrence(db, item)
        desired = payload.completed if payload.completed is not None else (occ.status != 'completed')

        if not desired:
            # 미완료로 설정
            uncomplete_occurrence(db, occ)
            occ.completed_by = None
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
            occ.completed_by = getattr(current_user, "name", None)
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


class ProgressRequest(BaseModel):
    in_progress: bool = True


@router.post("/{item_id}/progress", response_model=ApiResponse)
def set_progress(
    item_id: str,
    payload: ProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """진행 중(착수) 토글 — 현재 주기 occurrence 상태를 in_progress ↔ pending 으로."""
    from app.services.occurrence import EVENT_FREQS as _EV, ONE_TIME_FREQ
    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")

    is_one_time = item.frequency == ONE_TIME_FREQ
    target = None
    if is_one_time and getattr(item, "due_date", None):
        from datetime import date as _date
        try:
            target = _date.fromisoformat(item.due_date)
        except Exception:
            target = None

    if item.frequency not in _EV and not is_one_time:
        try:
            from app.services.occurrence import reconcile_occurrences
            reconcile_occurrences(db, item)
        except Exception:
            pass

    occ = get_or_create_occurrence(db, item, target if is_one_time else None)
    if occ.status == "completed":
        raise HTTPException(400, "이미 완료된 항목입니다.")
    set_occurrence_progress(db, occ, payload.in_progress, getattr(current_user, "name", None))
    db.commit()
    item = _query_with_history(db).filter(ChecklistItem.id == item_id).first()
    return ApiResponse(success=True, data=_cl_to_out(item))
