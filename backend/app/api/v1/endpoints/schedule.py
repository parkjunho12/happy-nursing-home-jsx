"""
통합 일정 (방문상담·외부방문·회의·기타).
권한: ADMIN 또는 사회복지사·시설장·대표·이사
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.schedule import ScheduleEvent, now_kst
from app.models.eval import LtcResident, LtcStaffMember
from app.models.staff_hr import StaffHrRecord
from app.models.resident_docs import ResidentDocStatus
from app.schemas.response import ApiResponse

router = APIRouter()

_KST = timezone(timedelta(hours=9))
CATEGORIES = ["방문상담", "외부방문", "회의", "행사", "기타"]


# 모든 일정 수정·삭제 가능(관리자급)
EVENT_ADMIN_POSITIONS = ("대표", "이사")


def _can_edit_event(user: User, e: ScheduleEvent) -> bool:
    """본인이 만든 일정은 수정 가능 · ADMIN/대표/이사는 전부 수정 가능."""
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    pos = getattr(user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role == "ADMIN" or pos in EVENT_ADMIN_POSITIONS:
        return True
    if e.created_by_id and e.created_by_id == user.id:
        return True
    # 레거시(작성자 id 미기록) — 이름으로 대체 판정
    if not e.created_by_id and e.created_by and e.created_by == getattr(user, "name", None):
        return True
    return False


def _require_manager(current_user: User = Depends(get_current_user)) -> User:
    """일정 캘린더는 앨범담당을 제외한 모든 직원이 사용 가능."""
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if pos == "앨범담당":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    return current_user


def _parse_dt(v: Optional[str]):
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        try:
            dt = datetime.strptime(v, "%Y-%m-%d %H:%M")
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_KST)
    return dt


def _kst(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_KST)
    return dt.astimezone(_KST)


def _view(e: ScheduleEvent, user: Optional[User] = None) -> dict:
    return {
        "can_edit": _can_edit_event(user, e) if user else False,
        "created_by_id": e.created_by_id,
        "id": e.id, "category": e.category, "title": e.title,
        "start_at": _kst(e.start_at).isoformat() if e.start_at else None,
        "end_at": _kst(e.end_at).isoformat() if e.end_at else None,
        "location": e.location, "contact_name": e.contact_name, "contact_phone": e.contact_phone,
        "memo": e.memo, "status": e.status,
        "created_by": e.created_by,
        "created_at": _kst(e.created_at).isoformat() if e.created_at else None,
    }


@router.get("/events")
def list_events(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_manager),
):
    q = db.query(ScheduleEvent)
    if start_date:
        sd = _parse_dt(start_date + "T00:00")
        if sd:
            q = q.filter(ScheduleEvent.start_at >= sd)
    if end_date:
        ed = _parse_dt(end_date + "T23:59")
        if ed:
            q = q.filter(ScheduleEvent.start_at <= ed)
    if category:
        q = q.filter(ScheduleEvent.category == category)
    rows = q.order_by(ScheduleEvent.start_at.asc()).all()
    return ApiResponse(success=True, data=[_view(e, current_user) for e in rows])


class EventBody(BaseModel):
    category: str = "기타"
    title: str
    start_at: str
    end_at: Optional[str] = None
    location: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    memo: Optional[str] = None


@router.post("/events")
def create_event(body: EventBody, db: Session = Depends(get_db),
                 current_user: User = Depends(_require_manager)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요.")
    at = _parse_dt(body.start_at)
    if not at:
        raise HTTPException(status_code=400, detail="일시 형식이 올바르지 않습니다.")
    e = ScheduleEvent(
        category=body.category if body.category in CATEGORIES else "기타",
        title=body.title.strip(), start_at=at, end_at=_parse_dt(body.end_at),
        location=body.location, contact_name=body.contact_name,
        contact_phone=(body.contact_phone or "").strip() or None, memo=body.memo,
        created_by=getattr(current_user, "name", None),
        created_by_id=current_user.id,
    )
    db.add(e); db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e, current_user))


class EventUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    location: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    memo: Optional[str] = None
    status: Optional[str] = None


@router.patch("/events/{eid}")
def update_event(eid: str, body: EventUpdate, db: Session = Depends(get_db),
                 current_user: User = Depends(_require_manager)):
    e = db.query(ScheduleEvent).filter(ScheduleEvent.id == eid).first()
    if not e:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    if not _can_edit_event(current_user, e):
        raise HTTPException(status_code=403, detail="본인이 등록한 일정만 수정할 수 있습니다.")
    if body.category is not None and body.category in CATEGORIES:
        e.category = body.category
    if body.title is not None and body.title.strip():
        e.title = body.title.strip()
    if body.start_at is not None:
        at = _parse_dt(body.start_at)
        if at:
            e.start_at = at
    if body.end_at is not None:
        e.end_at = _parse_dt(body.end_at)
    if body.location is not None:
        e.location = body.location
    if body.contact_name is not None:
        e.contact_name = body.contact_name
    if body.contact_phone is not None:
        e.contact_phone = body.contact_phone.strip() or None
    if body.memo is not None:
        e.memo = body.memo
    if body.status is not None:
        e.status = body.status
    e.updated_at = now_kst()
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e, current_user))


@router.delete("/events/{eid}")
def delete_event(eid: str, db: Session = Depends(get_db),
                 current_user: User = Depends(_require_manager)):
    e = db.query(ScheduleEvent).filter(ScheduleEvent.id == eid).first()
    if not e:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
    if not _can_edit_event(current_user, e):
        raise HTTPException(status_code=403, detail="본인이 등록한 일정만 삭제할 수 있습니다.")
    db.delete(e); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.get("/lifecycle")
def lifecycle(
    start_date: Optional[str] = Query(None),  # YYYY-MM-DD
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_manager),
):
    """수급자 입소일 · 직원 입사일을 파생 이벤트로 반환(등록 시 자동 반영)."""
    out = []

    rq = db.query(LtcResident).filter(LtcResident.admission_date.isnot(None))
    if start_date:
        rq = rq.filter(LtcResident.admission_date >= start_date)
    if end_date:
        rq = rq.filter(LtcResident.admission_date <= end_date)
    for r in rq.all():
        if not r.admission_date:
            continue
        out.append({
            "id": r.id, "kind": "admission", "name": r.name,
            "date": r.admission_date, "gender": r.gender, "status": r.status,
        })

    sq = db.query(LtcStaffMember).filter(LtcStaffMember.hire_date.isnot(None))
    if start_date:
        sq = sq.filter(LtcStaffMember.hire_date >= start_date)
    if end_date:
        sq = sq.filter(LtcStaffMember.hire_date <= end_date)
    for m in sq.all():
        if not m.hire_date:
            continue
        out.append({
            "id": m.id, "kind": "hire", "name": m.name,
            "date": m.hire_date, "gender": m.gender, "status": m.status,
        })

    return ApiResponse(success=True, data=out)


@router.get("/renewals")
def renewals(
    start_date: Optional[str] = Query(None),  # YYYY-MM-DD
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_manager),
):
    """재계약 예정일(ADMIN·시설장 전용). 그 외에는 빈 목록."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "시설장":
        return ApiResponse(success=True, data=[])

    q = db.query(StaffHrRecord).filter(
        StaffHrRecord.renewal_date.isnot(None),
        (StaffHrRecord.active == True) | (StaffHrRecord.active.is_(None)),  # noqa: E712
    )
    if start_date:
        q = q.filter(StaffHrRecord.renewal_date >= start_date)
    if end_date:
        q = q.filter(StaffHrRecord.renewal_date <= end_date)
    out = []
    for r in q.all():
        if not r.renewal_date:
            continue
        out.append({
            "id": r.id, "name": r.name, "position": r.position,
            "date": r.renewal_date,
        })
    return ApiResponse(success=True, data=out)


@router.get("/doc-events")
def doc_events(
    start_date: Optional[str] = Query(None),  # YYYY-MM-DD
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_manager),
):
    """어르신 서류(계약서·급여제공계획서·결과평가) 일시를 파생 이벤트로 반환."""
    out = []
    rows = db.query(ResidentDocStatus).filter(ResidentDocStatus.active == True).all()  # noqa: E712
    fields = (
        ("contract", "계약서", lambda r: r.contract_lines),
        ("plan", "급여제공계획서", lambda r: r.plan_lines),
        ("eval", "결과평가", lambda r: r.eval_lines),
    )
    for r in rows:
        for doc_type, label, getter in fields:
            for it in (getter(r) or []):
                if not isinstance(it, dict):
                    continue
                if it.get("done"):
                    continue   # 완료 처리된 일시는 캘린더에 표시하지 않음
                d = (it.get("date") or "").strip() if it.get("date") else None
                if not d:
                    continue
                if start_date and d < start_date:
                    continue
                if end_date and d > end_date:
                    continue
                out.append({
                    "id": f"{r.id}:{doc_type}:{d}",
                    "resident_id": r.resident_id,
                    "name": r.name,
                    "doc_type": doc_type,
                    "doc_label": label,
                    "date": d,
                    "kind": it.get("kind"),
                    "memo": it.get("memo"),
                })
    return ApiResponse(success=True, data=out)
