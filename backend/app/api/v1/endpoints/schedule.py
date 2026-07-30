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
from app.models.staff_education import StaffEducation
from app.schemas.response import ApiResponse

router = APIRouter()

_KST = timezone(timedelta(hours=9))
# 외출·외박은 분리 — 귀원 시점이 다르다 (외출=당일, 외박=다음날 이후)
CATEGORIES = ["방문상담", "외부방문", "회의", "행사", "외래·병원", "면회", "외출", "외박", "갱신", "퇴소", "기타"]


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
        "notice_id": e.notice_id,
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


# 일정 → 공개 공지 자동 생성 대상 분류 (보호자·가족 단톡에 공유하는 안내들)
NOTICE_CATEGORIES = ("외출", "외박", "외래·병원", "면회", "외부방문", "행사")

# 분류별 카톡 공유 카드 이미지 (apps/web/public/assets/notice-cards/)
# 주소 기준 = settings.PUBLIC_WEB_URL — 로컬(.env: http://localhost:3000)은 로컬 next dev에서,
# 운영(기본값 www)은 배포된 웹에서 서빙된다. 화면 표시는 양쪽 다 되고,
# 카카오 '카드 썸네일'만은 카카오 서버가 가져가므로 공개 https(운영)에서만 뜬다.
from app.core.config import settings as _settings

def _category_card(category: str):
    base = (_settings.PUBLIC_WEB_URL or "").rstrip("/")
    f = {"면회": "visit", "외래·병원": "hospital",
         "외부방문": "external", "외출": "outing", "외박": "outing"}.get(category)
    return f"{base}/assets/notice-cards/{f}.png" if (base and f) else None

WEEK_KO = ["월", "화", "수", "목", "금", "토", "일"]


def _notice_text(e: ScheduleEvent) -> tuple:
    """일정 내용으로 공지 제목·본문 생성 — 카톡 템플릿 그대로.

    일정이 수정되면 이 템플릿으로 다시 만들어 공지도 함께 바뀐다."""
    dt = _kst(e.start_at)
    w = WEEK_KO[dt.weekday()]
    when = f"{dt.month}월 {dt.day}일({w}) {dt.strftime('%H:%M')}"
    # 날짜를 맨 앞에 — 단톡방 목록에서 "언제"가 제일 먼저 보여야 한다
    title = f"{dt.month}/{dt.day}({w}) [{e.category}] {e.title}"
    lines = [
        f"안내드립니다 🙂",
        "",
        f"· 내용: {e.title}",
        f"· 일시: {when}",
    ]
    if e.end_at and e.category in ("외출", "외박"):
        rt = _kst(e.end_at)
        if rt.date() == dt.date():          # 외출 — 당일 귀원은 시간만
            lines.append(f"· 귀원: 당일 {rt.strftime('%H:%M')}")
        else:
            rw = WEEK_KO[rt.weekday()]
            lines.append(f"· 귀원: {rt.month}월 {rt.day}일({rw}) {rt.strftime('%H:%M')}")
    if e.location:
        lines.append(f"· 장소: {e.location}")
    if e.contact_name:
        # '담당'이 아니라 '연락처' — 어르신 상태를 가장 잘 아는 사람이 받는 번호다
        lines.append(f"· 연락처: {e.contact_name}" + (f" ({e.contact_phone})" if e.contact_phone else ""))
    if e.memo:
        lines += ["", e.memo]
    lines += ["", "궁금하신 점은 시설로 연락 부탁드립니다.", "— 행복한요양원"]
    return title, "\n".join(lines)


def _sync_notice(db: Session, e: ScheduleEvent, user: User, create: bool = False):
    """일정에 연결된 공개 공지를 만들거나 최신 내용으로 맞춘다."""
    from app.models.staffing import InternalNotice
    title, content = _notice_text(e)
    if e.notice_id:
        n = db.query(InternalNotice).filter(InternalNotice.id == e.notice_id).first()
        if n:
            n.title, n.content = title, content
            n.image_url = _category_card(e.category) or n.image_url
            n.active = e.status != "canceled"   # 일정 취소 → 공지도 내림
            return n
        e.notice_id = None                       # 공지가 지워졌으면 연결 해제
    if create:
        n = InternalNotice(title=title, content=content, level="info",
                           public=True,          # 로그인 없이 링크 열람 → 카톡 공유용
                           image_url=_category_card(e.category),
                           author_id=getattr(user, "id", None),
                           author_name=getattr(user, "name", None))
        db.add(n); db.flush()
        e.notice_id = n.id
        return n
    return None


class EventBody(BaseModel):
    category: str = "기타"
    title: str
    start_at: str
    end_at: Optional[str] = None
    location: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    memo: Optional[str] = None
    make_notice: Optional[bool] = None   # 공개 공지도 함께 만들기 (외출·외박/외래 등)


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
    db.add(e)
    notice = None
    if body.make_notice and e.category in NOTICE_CATEGORIES:
        db.flush()
        notice = _sync_notice(db, e, current_user, create=True)
    db.commit(); db.refresh(e)
    out = _view(e, current_user)
    if notice:
        out["notice_id"] = notice.id
    return ApiResponse(success=True, data=out)


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
    make_notice: Optional[bool] = None   # 수정하면서 공지를 새로 붙일 수도 있다


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
    # 연결된 공지가 있으면 항상 최신 내용으로 — 일정만 고치고 공지를 잊는 사고를 없앤다
    _sync_notice(db, e, current_user,
                 create=bool(body.make_notice) and e.category in NOTICE_CATEGORIES)
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
    if e.notice_id:
        from app.models.staffing import InternalNotice
        n = db.query(InternalNotice).filter(InternalNotice.id == e.notice_id).first()
        if n:
            n.active = False               # 일정이 사라지면 공지도 내린다
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
            "date": r.admission_date, "time": getattr(r, "admission_time", None),
            "gender": r.gender, "status": r.status,
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


@router.get("/edu-events")
def edu_events(
    start_date: Optional[str] = Query(None),  # YYYY-MM-DD
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # 교육 일정은 전 직원이 봐야 함
):
    """직원 의무교육(예정일·실시일)을 캘린더 이벤트로 반환."""
    out = []
    rows = db.query(StaffEducation).filter(StaffEducation.active == True).all()  # noqa: E712
    for e in rows:
        # 완료면 실시일, 미완료면 예정일 — 날짜가 없으면 캘린더에 띄우지 않는다
        d = (e.done_date if e.done else e.plan_date) or None
        if not d:
            continue
        if start_date and d < start_date:
            continue
        if end_date and d > end_date:
            continue
        out.append({
            "id": e.id,
            "date": d,
            "title": e.title,
            "division": e.division or "기타",
            "eval_no": e.eval_no,
            "org": e.org,
            "done": bool(e.done),
        })
    return ApiResponse(success=True, data=out)
