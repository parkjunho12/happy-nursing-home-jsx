"""병원동행 요청 — 간호팀이 올리고, 복지팀이 업체에 전달한다.

권한을 두 팀으로 나눈 이유:
  · 어르신 상태(보행·편마비·주의사항)는 간호팀이 본다. 복지팀이 짐작해
    적으면 그 짐작대로 차가 잡힌다.
  · 업체와의 연락은 복지팀이 한다.
관리자·시설장은 양쪽 다 할 수 있다 — 사람이 없는 날 일이 멈추면 안 된다.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.hospital_escort import (
    HospitalEscort, HospitalEscortLog,
    ST_DRAFT, ST_SHARED, ST_SENT, ST_DECIDED, ST_DONE, ST_CANCELED,
    WALKING, HEMIPLEGIA, WHEELCHAIR,
)
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services import escort_text as et

logger = logging.getLogger(__name__)
router = APIRouter()
KST = timezone(timedelta(hours=9))

MANAGE = ("시설장", "대표", "이사")
NURSE = ("간호팀장", "간호사", "간호조무사")
WELFARE = ("사회복지사",)


def _pos(u) -> str:
    p = getattr(u, "position", None)
    return p.value if hasattr(p, "value") else str(p or "")


def _role(u) -> str:
    r = getattr(u, "role", None)
    return r.value if hasattr(r, "value") else str(r or "")


def can_view(role: str, pos: Optional[str]) -> bool:
    """어르신 건강 상태가 적히는 표다 — 다루는 두 팀과 관리자까지."""
    return role == "ADMIN" or (pos or "") in (MANAGE + NURSE + WELFARE)


def can_write_nursing(role: str, pos: Optional[str]) -> bool:
    """상태를 적는 것은 간호팀. 관리자·시설장도 할 수 있다."""
    return role == "ADMIN" or (pos or "") in (MANAGE + NURSE)


def can_write_welfare(role: str, pos: Optional[str]) -> bool:
    """업체 전달·이동수단 기록은 복지팀. 관리자·시설장도 할 수 있다."""
    return role == "ADMIN" or (pos or "") in (MANAGE + WELFARE)


def _viewer(u: User = Depends(get_current_user)) -> User:
    if not can_view(_role(u), _pos(u)):
        raise HTTPException(403, "병원동행 요청 열람 권한이 없습니다. (간호팀·복지팀·관리자)")
    return u


def _nursing(u: User = Depends(get_current_user)) -> User:
    if not can_write_nursing(_role(u), _pos(u)):
        raise HTTPException(403, "어르신 상태는 간호팀이 적습니다. (간호팀·시설장·관리자)")
    return u


def _welfare(u: User = Depends(get_current_user)) -> User:
    if not can_write_welfare(_role(u), _pos(u)):
        raise HTTPException(403, "업체 전달·이동수단은 복지팀이 적습니다. (사회복지사·시설장·관리자)")
    return u


def _now() -> datetime:
    return datetime.now(KST)


def _stamp(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    d = dt.astimezone(KST) if dt.tzinfo else dt
    return f"{d.month}/{d.day} {d:%H:%M}"


def _dict(e: HospitalEscort) -> Dict[str, Any]:
    return {
        "id": e.id, "resident_id": e.resident_id, "resident_name": e.resident_name,
        "floor": e.floor, "room": e.room,
        "walking": e.walking, "hemiplegia": e.hemiplegia, "wheelchair": e.wheelchair,
        "notes": e.notes, "hospital": e.hospital, "department": e.department,
        "visit_date": e.visit_date, "visit_time": e.visit_time,
        "status": e.status,
        "vendor": e.vendor, "transport": e.transport, "transport_note": e.transport_note,
        "cancel_reason": e.cancel_reason,
        "shared_at": e.shared_at.isoformat() if e.shared_at else None, "shared_by": e.shared_by,
        "sent_at": e.sent_at.isoformat() if e.sent_at else None, "sent_by": e.sent_by,
        "decided_at": e.decided_at.isoformat() if e.decided_at else None, "decided_by": e.decided_by,
        "done_at": e.done_at.isoformat() if e.done_at else None, "done_by": e.done_by,
        "created_by": e.created_by,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _view(e: HospitalEscort, u: User) -> Dict[str, Any]:
    d = _dict(e)
    # 붙여넣을 글은 서버가 만든다 — 화면마다 다른 글이 나가지 않게
    d["request_text"] = et.request_text(d, writer=e.created_by, stamp=_stamp(e.created_at))
    d["decision_text"] = (et.decision_text(d, writer=e.decided_by, stamp=_stamp(e.decided_at))
                          if e.transport else None)
    d["missing"] = et.missing_fields(d)
    d["can_nursing"] = can_write_nursing(_role(u), _pos(u))
    d["can_welfare"] = can_write_welfare(_role(u), _pos(u))
    return d


def _log(db: Session, e: HospitalEscort, action: str, actor: Optional[str],
         memo: Optional[str] = None) -> None:
    db.add(HospitalEscortLog(escort_id=e.id, action=action, actor=actor,
                             memo=(memo or "").strip() or None))


@router.get("")
def list_escorts(scope: str = Query("open", description="open | all | done"),
                 db: Session = Depends(get_db), u: User = Depends(_viewer)):
    """진행 중인 것이 먼저. 지난 것은 scope=done 으로 본다."""
    q = db.query(HospitalEscort)
    if scope == "open":
        q = q.filter(HospitalEscort.status.notin_([ST_DONE, ST_CANCELED]))
    elif scope == "done":
        q = q.filter(HospitalEscort.status.in_([ST_DONE, ST_CANCELED]))
    rows = q.order_by(HospitalEscort.visit_date.asc(),
                      HospitalEscort.visit_time.asc().nullslast()).all()
    if scope != "open":
        rows = sorted(rows, key=lambda r: (r.visit_date or "", r.visit_time or ""), reverse=True)
    return ApiResponse(success=True, data={
        "items": [_view(r, u) for r in rows],
        "options": {"walking": WALKING, "hemiplegia": HEMIPLEGIA, "wheelchair": WHEELCHAIR},
        "can_nursing": can_write_nursing(_role(u), _pos(u)),
        "can_welfare": can_write_welfare(_role(u), _pos(u)),
    })


class EscortBody(BaseModel):
    resident_id: Optional[str] = None
    resident_name: str
    floor: Optional[str] = None
    room: Optional[str] = None
    walking: Optional[str] = None
    hemiplegia: Optional[str] = None
    wheelchair: Optional[str] = None
    notes: Optional[str] = None
    hospital: str
    department: Optional[str] = None
    visit_date: str
    visit_time: Optional[str] = None


def _check(b: EscortBody) -> None:
    if b.walking and b.walking not in WALKING:
        raise HTTPException(400, f"보행은 {' · '.join(WALKING)} 중 하나여야 합니다.")
    if b.hemiplegia and b.hemiplegia not in HEMIPLEGIA:
        raise HTTPException(400, f"편마비는 {' · '.join(HEMIPLEGIA)} 중 하나여야 합니다.")
    if b.wheelchair and b.wheelchair not in WHEELCHAIR:
        raise HTTPException(400, f"휠체어는 {' · '.join(WHEELCHAIR)} 중 하나여야 합니다.")
    if len(b.visit_date or "") != 10:
        raise HTTPException(400, "진료 날짜는 YYYY-MM-DD 형식이어야 합니다.")
    if not (b.resident_name or "").strip():
        raise HTTPException(400, "어르신 성함이 필요합니다.")
    if not (b.hospital or "").strip():
        raise HTTPException(400, "병원명이 필요합니다.")


@router.post("")
def create(body: EscortBody, db: Session = Depends(get_db), u: User = Depends(_nursing)):
    _check(body)
    e = HospitalEscort(**body.model_dump(), status=ST_DRAFT,
                       created_by=getattr(u, "name", None))
    db.add(e)
    db.flush()
    _log(db, e, "create", getattr(u, "name", None))
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


@router.patch("/{eid}")
def edit(eid: str, body: EscortBody, db: Session = Depends(get_db), u: User = Depends(_nursing)):
    """상태나 일정이 바뀌면 고친다.

    이미 톡방에 올렸거나 업체에 전달한 뒤라면 다시 공유해야 한다 —
    바뀐 줄 모르고 옛 내용으로 차가 잡히면 그날 문제가 된다.
    """
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    _check(body)
    before = {k: getattr(e, k) for k in body.model_dump()}
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    changed = [k for k, v in before.items() if v != getattr(e, k)]
    if changed and e.status in (ST_SHARED, ST_SENT, ST_DECIDED):
        # 다시 공유해야 한다는 뜻으로 되돌린다
        e.status = ST_DRAFT
        e.shared_at = e.shared_by = None
    _log(db, e, "edit", getattr(u, "name", None),
         f"{', '.join(changed)} 고침" if changed else None)
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


class StepBody(BaseModel):
    memo: Optional[str] = None
    vendor: Optional[str] = None
    transport: Optional[str] = None
    transport_note: Optional[str] = None
    reason: Optional[str] = None


@router.post("/{eid}/share")
def mark_shared(eid: str, body: StepBody, db: Session = Depends(get_db),
                u: User = Depends(_nursing)):
    """부서 톡방에 올렸다고 표시한다."""
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    e.shared_at, e.shared_by = _now(), getattr(u, "name", None)
    if e.status == ST_DRAFT:
        e.status = ST_SHARED
    _log(db, e, "share", getattr(u, "name", None), body.memo)
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


@router.post("/{eid}/send")
def mark_sent(eid: str, body: StepBody, db: Session = Depends(get_db),
              u: User = Depends(_welfare)):
    """업체에 전달했다고 표시한다.

    이동수단을 정하는 근거가 비어 있으면 막는다 — 업체가 어르신을 보지
    않고 차를 잡게 된다.
    """
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    miss = et.missing_fields(_dict(e))
    if miss:
        raise HTTPException(400, f"간호팀 확인이 먼저 필요합니다 — {' · '.join(miss)}")
    e.vendor = (body.vendor or e.vendor or "").strip() or None
    e.sent_at, e.sent_by = _now(), getattr(u, "name", None)
    if e.status in (ST_DRAFT, ST_SHARED):
        e.status = ST_SENT
    _log(db, e, "send", getattr(u, "name", None),
         " · ".join(x for x in [e.vendor, (body.memo or "").strip()] if x))
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


@router.post("/{eid}/decide")
def mark_decided(eid: str, body: StepBody, db: Session = Depends(get_db),
                 u: User = Depends(_welfare)):
    """보호자와 업체가 협의해 정한 이동수단을 적는다.

    시설이 정하는 것이 아니다 — 그래서 '무엇으로 정해졌는지' 를 받아 적을
    뿐, 고르는 목록을 두지 않았다.
    """
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    t = (body.transport or "").strip()
    if not t:
        raise HTTPException(400, "정해진 이동수단을 적어 주세요. (보호자·업체 협의 결과)")
    e.transport = t[:120]
    e.transport_note = (body.transport_note or "").strip() or None
    e.decided_at, e.decided_by = _now(), getattr(u, "name", None)
    if e.status in (ST_DRAFT, ST_SHARED, ST_SENT):
        e.status = ST_DECIDED
    _log(db, e, "decide", getattr(u, "name", None),
         " · ".join(x for x in [t, e.transport_note or ""] if x))
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


@router.post("/{eid}/done")
def mark_done(eid: str, body: StepBody, db: Session = Depends(get_db),
              u: User = Depends(_viewer)):
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    e.status = ST_DONE
    e.done_at, e.done_by = _now(), getattr(u, "name", None)
    _log(db, e, "done", getattr(u, "name", None), body.memo)
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


@router.post("/{eid}/cancel")
def mark_canceled(eid: str, body: StepBody, db: Session = Depends(get_db),
                  u: User = Depends(_viewer)):
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    if not (body.reason or "").strip():
        raise HTTPException(400, "취소 사유를 적어 주세요. (진료 연기·보호자 동행 등)")
    e.status = ST_CANCELED
    e.cancel_reason = body.reason.strip()[:200]
    _log(db, e, "cancel", getattr(u, "name", None), e.cancel_reason)
    db.commit()
    db.refresh(e)
    return ApiResponse(success=True, data=_view(e, u))


@router.get("/{eid}/logs")
def logs(eid: str, db: Session = Depends(get_db), _: User = Depends(_viewer)):
    """누가 무엇을 언제 했는지 — 구두로만 전하지 않기 위한 기록."""
    rows = (db.query(HospitalEscortLog)
            .filter(HospitalEscortLog.escort_id == eid)
            .order_by(HospitalEscortLog.created_at.desc()).all())
    label = {"create": "요청 작성", "share": "부서 톡방 공유", "send": "업체 전달",
             "decide": "이동수단 확정", "done": "동행 완료", "cancel": "취소",
             "edit": "내용 수정"}
    return ApiResponse(success=True, data=[{
        "id": r.id, "action": r.action, "label": label.get(r.action, r.action),
        "memo": r.memo, "actor": r.actor,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows])


@router.delete("/{eid}")
def remove(eid: str, db: Session = Depends(get_db), u: User = Depends(_nursing)):
    """잘못 올린 줄만 지운다 — 이미 업체에 전달한 것은 취소로 남긴다.

    상태가 아니라 '전달한 흔적' 을 본다. 내용을 고치면 다시 공유하라고
    상태가 draft 로 돌아가는데, 그때 상태만 보면 이미 업체에 넘긴 건까지
    지워진다 — 업체는 받았는데 우리 쪽에는 아무 기록도 없게 된다.
    """
    e = db.query(HospitalEscort).filter(HospitalEscort.id == eid).first()
    if not e:
        raise HTTPException(404, "그 요청을 찾을 수 없습니다.")
    if e.sent_at or e.decided_at or e.done_at:
        raise HTTPException(400, "이미 업체에 전달한 요청은 지울 수 없습니다. 취소로 남겨 주세요.")
    db.query(HospitalEscortLog).filter(HospitalEscortLog.escort_id == eid).delete()
    db.delete(e)
    db.commit()
    return ApiResponse(success=True, data={"deleted": eid})
