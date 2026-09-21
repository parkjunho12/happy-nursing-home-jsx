"""입소 상담 기록 — 전화를 받으면서 채우는 한 장.

권한: 전화를 받는 자리 — 사회복지사·간호팀·시설장·대표·이사·관리자.
      어르신 건강 상태와 보호자 연락처가 적히는 표라 그 밖으로는 열지 않는다.

필수 항목은 상담일시 하나뿐이다. 통화 중에 빈칸 때문에 저장이 막히면
그 순간 보호자를 기다리게 한다. 무엇이 비었는지는 화면이 알려준다.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.consult import Consult, STATUSES, ST_OPEN, ST_DONE, ST_DROP
from app.models.user import User
from app.schemas.response import ApiResponse

router = APIRouter()
KST = timezone(timedelta(hours=9))

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME = re.compile(r"^\d{2}:\d{2}$")

# 전화를 받는 자리. 상담 전화는 복지팀만 받지 않는다 — 사무실에 있는
# 사람이 받는다. 좁히면 '복지 선생님 오시면 다시 전화 주세요' 가 된다.
WRITERS = ("시설장", "대표", "이사", "사회복지사", "간호팀장", "간호사", "간호조무사")


def _pos(u) -> str:
    p = getattr(u, "position", None)
    return p.value if hasattr(p, "value") else str(p or "")


def _role(u) -> str:
    r = getattr(u, "role", None)
    return r.value if hasattr(r, "value") else str(r or "")


def can_use(role: str, pos: Optional[str]) -> bool:
    return role == "ADMIN" or (pos or "") in WRITERS


def _writer(u: User = Depends(get_current_user)) -> User:
    if not can_use(_role(u), _pos(u)):
        raise HTTPException(403, "입소 상담 권한이 없습니다. (복지팀·간호팀·시설장·관리자)")
    return u


# 화면이 그대로 저장하는 칸들 — 하나씩 적으면 새 항목이 늘 때마다 빠뜨린다
TEXT_FIELDS = (
    "consulted_at", "counselor", "route", "method", "caller",
    "resident_name", "gender", "height_cm", "weight_kg", "living", "living_note",
    "grade", "benefit", "copay", "grade_note",
    "diagnosis", "behavior", "sleep", "hearing", "hearing_aid", "vision", "glasses",
    "speech", "mobility", "toileting", "eating", "diet", "health_note",
    "children", "guardian_name", "guardian_relation", "guardian_phone", "address",
    "checkup", "checkup_note", "notes", "guided",
)


class ConsultBody(BaseModel):
    consulted_on: Optional[str] = None
    consulted_at: Optional[str] = None
    counselor: Optional[str] = None
    route: Optional[str] = None
    method: Optional[str] = None
    caller: Optional[str] = None

    resident_name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[Any] = None
    height_cm: Optional[str] = None
    weight_kg: Optional[str] = None
    living: Optional[str] = None
    living_note: Optional[str] = None

    grade: Optional[str] = None
    benefit: Optional[str] = None
    copay: Optional[str] = None
    grade_note: Optional[str] = None

    diagnosis: Optional[str] = None
    behavior: Optional[str] = None
    sleep: Optional[str] = None
    hearing: Optional[str] = None
    hearing_aid: Optional[str] = None
    vision: Optional[str] = None
    glasses: Optional[str] = None
    speech: Optional[str] = None
    mobility: Optional[str] = None
    toileting: Optional[str] = None
    eating: Optional[str] = None
    diet: Optional[str] = None
    health_note: Optional[str] = None

    children: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_phone: Optional[str] = None
    address: Optional[str] = None

    checkup: Optional[str] = None
    checkup_note: Optional[str] = None
    wish_date: Optional[str] = None
    notes: Optional[str] = None
    guided: Optional[str] = None

    status: Optional[str] = None
    followup_on: Optional[str] = None


def _dict(c: Consult) -> Dict[str, Any]:
    d = {f: getattr(c, f) for f in TEXT_FIELDS}
    d.update({
        "id": c.id,
        "consulted_on": c.consulted_on,
        "age": c.age,
        "wish_date": c.wish_date,
        "status": c.status,
        "followup_on": c.followup_on,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_by": c.updated_by,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    })
    return d


def _clean(v: Optional[str], limit: int) -> Optional[str]:
    s = (v or "").strip()
    return s[:limit] if s else None


def _age(v: Any) -> Optional[int]:
    """연령. 비워도 되고, 말이 안 되는 값은 받지 않는다.

    '85세' 처럼 단위를 붙여 적는 일이 잦아 숫자만 뽑는다 — 통화 중에 적는
    칸이라 형식이 틀렸다고 되돌려 보내면 그 자리에서 막힌다.
    """
    if v is None or str(v).strip() == "":
        return None
    m = re.search(r"\d{1,3}", str(v))
    if not m:
        return None
    n = int(m.group())
    return n if 0 <= n <= 120 else None


def _apply(c: Consult, b: ConsultBody, who: Optional[str]) -> None:
    data = b.model_dump(exclude_unset=True) if hasattr(b, "model_dump") else b.dict(exclude_unset=True)

    if "consulted_on" in data:
        v = (b.consulted_on or "").strip()
        if not _DATE.match(v):
            raise HTTPException(400, "상담일은 YYYY-MM-DD 형식이어야 합니다.")
        c.consulted_on = v
    for f in ("wish_date", "followup_on"):
        if f in data:
            v = (getattr(b, f) or "").strip()
            if v and not _DATE.match(v):
                raise HTTPException(400, "날짜는 YYYY-MM-DD 형식이어야 합니다.")
            setattr(c, f, v or None)
    if "consulted_at" in data:
        v = (b.consulted_at or "").strip()
        if v and not _TIME.match(v):
            raise HTTPException(400, "상담 시각은 HH:MM 형식이어야 합니다.")
        c.consulted_at = v or None
    if "status" in data:
        v = (b.status or "").strip() or ST_OPEN
        if v not in STATUSES:
            raise HTTPException(400, f"알 수 없는 상태입니다: {v}")
        c.status = v
    if "age" in data:
        c.age = _age(b.age)

    # 긴 글과 짧은 글의 길이를 나눠 자른다 — DB 칸 길이를 넘으면 저장이
    # 통째로 실패한다. 통화 중에 그러면 적은 것을 다 잃는다.
    long_fields = ("diagnosis", "behavior", "health_note", "notes", "guided")
    for f in TEXT_FIELDS:
        if f == "consulted_at" or f not in data:
            continue
        limit = 4000 if f in long_fields else 200
        setattr(c, f, _clean(getattr(b, f), limit))
    c.updated_by = who


@router.get("")
def list_consults(scope: str = Query("open", description="open | all | done"),
                  q: Optional[str] = Query(None),
                  db: Session = Depends(get_db), u: User = Depends(_writer)):
    """최근 상담이 위로. 진행 중인 것만 보는 것이 기본이다."""
    qs = db.query(Consult)
    if scope == "open":
        qs = qs.filter(Consult.status.notin_([ST_DONE, ST_DROP]))
    elif scope == "done":
        qs = qs.filter(Consult.status.in_([ST_DONE, ST_DROP]))
    s = (q or "").strip()
    if s:
        like = f"%{s}%"
        qs = qs.filter(or_(Consult.resident_name.ilike(like),
                           Consult.guardian_name.ilike(like),
                           Consult.guardian_phone.ilike(like),
                           Consult.counselor.ilike(like)))
    rows = (qs.order_by(Consult.consulted_on.desc(),
                        Consult.consulted_at.desc().nullslast(),
                        Consult.created_at.desc())
            .limit(500).all())
    return ApiResponse(success=True, data={"items": [_dict(r) for r in rows]})


@router.post("")
def create_consult(body: ConsultBody, db: Session = Depends(get_db), u: User = Depends(_writer)):
    if not (body.consulted_on or "").strip():
        body.consulted_on = datetime.now(KST).strftime("%Y-%m-%d")
    c = Consult(consulted_on=datetime.now(KST).strftime("%Y-%m-%d"), status=ST_OPEN)
    _apply(c, body, getattr(u, "name", None))
    c.created_by = getattr(u, "name", None)
    db.add(c); db.commit(); db.refresh(c)
    return ApiResponse(success=True, data=_dict(c))


@router.get("/{consult_id}")
def get_consult(consult_id: str, db: Session = Depends(get_db), _: User = Depends(_writer)):
    c = db.query(Consult).filter(Consult.id == consult_id).first()
    if not c:
        raise HTTPException(404, "상담 기록을 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_dict(c))


@router.put("/{consult_id}")
def update_consult(consult_id: str, body: ConsultBody,
                   db: Session = Depends(get_db), u: User = Depends(_writer)):
    c = db.query(Consult).filter(Consult.id == consult_id).first()
    if not c:
        raise HTTPException(404, "상담 기록을 찾을 수 없습니다.")
    _apply(c, body, getattr(u, "name", None))
    db.commit(); db.refresh(c)
    return ApiResponse(success=True, data=_dict(c))


@router.delete("/{consult_id}")
def delete_consult(consult_id: str, db: Session = Depends(get_db), u: User = Depends(_writer)):
    """지우는 것은 관리자·시설장만. 상담 기록은 나중에 '그때 뭐라고 하셨는지'
    를 확인하는 근거가 된다 — 통화 한 번으로 지워지면 안 된다."""
    if _role(u) != "ADMIN" and _pos(u) not in ("시설장", "대표", "이사"):
        raise HTTPException(403, "상담 기록 삭제는 관리자·시설장만 할 수 있습니다.")
    c = db.query(Consult).filter(Consult.id == consult_id).first()
    if not c:
        raise HTTPException(404, "상담 기록을 찾을 수 없습니다.")
    db.delete(c); db.commit()
    return ApiResponse(success=True, data={"deleted": consult_id})
