"""보호자 면회 예약 — 신청(보호자) → 승인(관리자) → 일정 캘린더 '면회' 자동 등록.

전화로 받던 면회 약속을 앱으로 옮긴다. 사무실 응대 부담을 줄이는 게 목적이라
승인·반려 결과는 보호자에게 푸시로 바로 알린다.
- 보호자: /api/v1/family/visits
- 관리자: /api/v1/admin/visits (ADMIN·시설장·사회복지사)
"""
from __future__ import annotations
import re
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.visit import VisitReservation, now_kst, KST
from app.models.album import GuardianAccount, ResidentGuardian
from app.models.push import FamilyPushToken
from app.models.schedule import ScheduleEvent
from app.api.v1.endpoints.albums import get_guardian_id
from app.schemas.response import ApiResponse
from app.services.fcm import send_to_tokens

logger = logging.getLogger(__name__)
family_router = APIRouter()
admin_router = APIRouter()

_D = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_T = re.compile(r"^\d{2}:\d{2}$")


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "사회복지사"):
        raise HTTPException(403, "면회 예약 처리 권한이 없습니다. (관리자·시설장·사회복지사)")
    return current_user


def _view(r: VisitReservation) -> dict:
    return {
        "id": r.id,
        "guardian_id": r.guardian_id, "guardian_name": r.guardian_name,
        "resident_id": r.resident_id, "resident_name": r.resident_name,
        "relation": r.relation,
        "date": r.date, "time": r.time, "visitors": r.visitors or 1,
        "memo": r.memo, "status": r.status, "reject_reason": r.reject_reason,
        "decided_by": r.decided_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _push_guardian(db: Session, guardian_id: str, title: str, body: str):
    """보호자 푸시 — 실패해도 예약 처리 자체는 유지한다."""
    try:
        tokens = [t.token for t in db.query(FamilyPushToken)
                  .filter(FamilyPushToken.guardian_id == guardian_id).all()]
        if tokens:
            _, _, invalid = send_to_tokens(tokens, title, body, data={"type": "visit"})
            if invalid:
                db.query(FamilyPushToken).filter(FamilyPushToken.token.in_(invalid)) \
                    .delete(synchronize_session=False)
                db.commit()
    except Exception as e:
        logger.warning(f"면회 예약 푸시 생략: {e}")


# ═══════════════════════ 보호자 ═══════════════════════

class VisitBody(BaseModel):
    resident_id: str
    date: str          # YYYY-MM-DD
    time: str          # HH:MM
    visitors: int = 1
    memo: Optional[str] = None


@family_router.post("/visits")
def create_visit(body: VisitBody, gid: str = Depends(get_guardian_id),
                 db: Session = Depends(get_db)):
    if not _D.match(body.date) or not _T.match(body.time):
        raise HTTPException(400, "날짜·시간 형식이 잘못됐습니다.")
    if body.date < now_kst().strftime("%Y-%m-%d"):
        raise HTTPException(400, "지난 날짜로는 예약할 수 없습니다.")
    if not (1 <= body.visitors <= 20):
        raise HTTPException(400, "방문 인원은 1~20명까지입니다.")

    link = db.query(ResidentGuardian).filter(
        ResidentGuardian.guardian_id == gid,
        ResidentGuardian.resident_id == body.resident_id).first()
    if not link:
        raise HTTPException(403, "연결된 어르신이 아닙니다.")

    dup = db.query(VisitReservation).filter(
        VisitReservation.guardian_id == gid,
        VisitReservation.date == body.date,
        VisitReservation.status.in_(["pending", "approved"])).first()
    if dup:
        raise HTTPException(409, f"{body.date}에 이미 신청한 예약이 있습니다.")

    g = db.query(GuardianAccount).filter(GuardianAccount.id == gid).first()
    from app.models.eval import LtcResident
    res = db.query(LtcResident).filter(LtcResident.id == body.resident_id).first()

    r = VisitReservation(
        guardian_id=gid, guardian_name=g.name if g else None,
        resident_id=body.resident_id, resident_name=res.name if res else None,
        relation=link.relation,
        date=body.date, time=body.time, visitors=body.visitors,
        memo=(body.memo or "").strip() or None,
    )
    db.add(r); db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@family_router.get("/visits/mine")
def my_visits(gid: str = Depends(get_guardian_id), db: Session = Depends(get_db)):
    rows = (db.query(VisitReservation)
            .filter(VisitReservation.guardian_id == gid)
            .order_by(VisitReservation.date.desc()).limit(30).all())
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@family_router.delete("/visits/{rid}")
def cancel_visit(rid: str, gid: str = Depends(get_guardian_id),
                 db: Session = Depends(get_db)):
    r = db.query(VisitReservation).filter(
        VisitReservation.id == rid, VisitReservation.guardian_id == gid).first()
    if not r:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    if r.status not in ("pending", "approved"):
        raise HTTPException(400, "이미 처리된 예약입니다.")
    was_approved = r.status == "approved"
    r.status = "canceled"
    # 승인돼 캘린더에 올라간 일정도 함께 취소 처리
    if was_approved and r.schedule_event_id:
        ev = db.query(ScheduleEvent).filter(ScheduleEvent.id == r.schedule_event_id).first()
        if ev:
            ev.status = "canceled"
    db.commit()
    return ApiResponse(success=True, message="예약을 취소했습니다.")


# ═══════════════════════ 관리자 ═══════════════════════

@admin_router.get("/visits")
def list_visits(status: Optional[str] = "pending", db: Session = Depends(get_db),
                _: User = Depends(_manager)):
    q = db.query(VisitReservation)
    if status:
        q = q.filter(VisitReservation.status == status)
    rows = q.order_by(VisitReservation.date.asc(), VisitReservation.time.asc()).limit(200).all()
    return ApiResponse(success=True, data=[_view(r) for r in rows])


class VisitDecideBody(BaseModel):
    approve: bool
    note: Optional[str] = None    # 반려 사유 또는 안내


@admin_router.patch("/visits/{rid}")
def decide_visit(rid: str, body: VisitDecideBody, db: Session = Depends(get_db),
                 current_user: User = Depends(_manager)):
    r = db.query(VisitReservation).filter(VisitReservation.id == rid).first()
    if not r:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    if r.status != "pending":
        raise HTTPException(400, "이미 처리된 예약입니다.")

    r.status = "approved" if body.approve else "rejected"
    r.decided_by = getattr(current_user, "name", None)
    r.decided_at = now_kst()

    if body.approve:
        # 승인 = 일정 캘린더 '면회' 일정 자동 등록 — 옮겨 적는 단계를 없앤다
        y, m, d = int(r.date[:4]), int(r.date[5:7]), int(r.date[8:10])
        hh, mm = int(r.time[:2]), int(r.time[3:5])
        ev = ScheduleEvent(
            category="면회",
            title=f"{r.resident_name or '어르신'} 면회 — {r.guardian_name or '보호자'}"
                  + (f"({r.relation})" if r.relation else "")
                  + (f" 외 {r.visitors - 1}명" if (r.visitors or 1) > 1 else ""),
            start_at=datetime(y, m, d, hh, mm, tzinfo=KST),
            contact_name=r.guardian_name,
            memo=r.memo,
            created_by=getattr(current_user, "name", None),
            created_by_id=getattr(current_user, "id", None),
        )
        db.add(ev); db.flush()
        r.schedule_event_id = ev.id
        push_body = f"{r.date} {r.time} 면회 예약이 확정되었습니다. 뵙겠습니다!"
        if body.note:
            push_body += f" ({body.note})"
    else:
        r.reject_reason = (body.note or "").strip() or None
        push_body = f"{r.date} {r.time} 면회 예약이 어렵습니다." \
                    + (f" 사유: {body.note}" if body.note else "") + " 다른 시간으로 다시 신청해주세요."
    db.commit()

    _push_guardian(db, r.guardian_id, "면회 예약 결과", push_body)
    return ApiResponse(success=True, data=_view(r))
