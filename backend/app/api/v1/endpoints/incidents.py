"""낙상·사고 보고서 API.

인수인계 AI가 잡아낸 긴급 항목(낙상·응급·투약 등)을 후보로 올려주고,
한 번 클릭으로 정식 보고서를 만든다. 보고서에는 보호자 안내 이력이 함께 남는다.
권한: ADMIN · 시설장 (사고 기록은 민감 정보라 열람도 제한한다)
"""
from __future__ import annotations
import re
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.incident import IncidentReport, now_kst
from app.models.handover import HandoverReport
from app.schemas.response import ApiResponse

router = APIRouter()
_D = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TYPES = ("낙상", "상처·욕창", "투약", "발열", "식사", "행동", "기타")
SEVERITIES = ("경미", "중등", "심각")
# 인수인계 카테고리 → 보고서 유형
HANDOVER_TYPE = {"낙상": "낙상", "응급": "기타", "투약": "투약", "활력징후": "발열",
                 "식사": "식사", "행동": "행동"}


def _writer(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "대표", "이사", "간호팀장", "간호사", "간호조무사"):
        raise HTTPException(403, "사고 보고서 권한이 없습니다. (관리자·시설장·대표·이사)")
    return current_user


def _view(r: IncidentReport) -> dict:
    return {
        "id": r.id, "resident_id": r.resident_id, "resident_name": r.resident_name,
        "type": r.type, "severity": r.severity or "경미",
        "occurred_date": r.occurred_date, "occurred_time": r.occurred_time,
        "location": r.location, "description": r.description,
        "action": r.action, "follow_up": r.follow_up,
        "guardian_notified": bool(r.guardian_notified),
        "guardian_notified_at": r.guardian_notified_at.isoformat() if r.guardian_notified_at else None,
        "guardian_method": r.guardian_method, "guardian_note": r.guardian_note,
        "status": r.status or "open", "source": r.source or "manual",
        "handover_ref": r.handover_ref,
        "reporter_name": r.reporter_name,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class IncidentBody(BaseModel):
    resident_id: Optional[str] = None
    resident_name: Optional[str] = None
    type: str
    severity: Optional[str] = "경미"
    occurred_date: str
    occurred_time: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    action: Optional[str] = None
    follow_up: Optional[str] = None
    guardian_notified: Optional[bool] = None
    guardian_method: Optional[str] = None
    guardian_note: Optional[str] = None
    status: Optional[str] = None
    handover_ref: Optional[str] = None   # 인수인계에서 가져온 경우


@router.get("")
def list_incidents(year: Optional[int] = None, resident_id: Optional[str] = None,
                   status: Optional[str] = None,
                   db: Session = Depends(get_db), _: User = Depends(_writer)):
    q = db.query(IncidentReport)
    if year:
        q = q.filter(IncidentReport.occurred_date.like(f"{year}-%"))
    if resident_id:
        q = q.filter(IncidentReport.resident_id == resident_id)
    if status:
        q = q.filter(IncidentReport.status == status)
    rows = q.order_by(IncidentReport.occurred_date.desc(),
                      IncidentReport.occurred_time.desc()).limit(500).all()
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@router.post("", status_code=201)
def create_incident(body: IncidentBody, db: Session = Depends(get_db),
                    current_user: User = Depends(_writer)):
    if body.type not in TYPES:
        raise HTTPException(400, f"유형은 {', '.join(TYPES)} 중 하나여야 합니다.")
    if not _D.match(body.occurred_date):
        raise HTTPException(400, "발생일 형식이 잘못됐습니다.")
    if body.handover_ref and db.query(IncidentReport).filter(
            IncidentReport.handover_ref == body.handover_ref).first():
        raise HTTPException(409, "이미 보고서로 등록된 인수인계 항목입니다.")

    r = IncidentReport(
        resident_id=body.resident_id, resident_name=(body.resident_name or "").strip() or None,
        type=body.type, severity=body.severity if body.severity in SEVERITIES else "경미",
        occurred_date=body.occurred_date, occurred_time=body.occurred_time,
        location=(body.location or "").strip() or None,
        description=(body.description or "").strip() or None,
        action=(body.action or "").strip() or None,
        follow_up=(body.follow_up or "").strip() or None,
        guardian_notified=bool(body.guardian_notified),
        guardian_notified_at=now_kst() if body.guardian_notified else None,
        guardian_method=body.guardian_method, guardian_note=(body.guardian_note or "").strip() or None,
        source="handover" if body.handover_ref else "manual",
        handover_ref=body.handover_ref,
        reporter_name=getattr(current_user, "name", None),
        created_by=getattr(current_user, "id", None),
    )
    db.add(r); db.commit(); db.refresh(r)
    return ApiResponse(success=True, data=_view(r))


@router.patch("/{rid}")
def update_incident(rid: str, body: IncidentBody, db: Session = Depends(get_db),
                    current_user: User = Depends(_writer)):
    r = db.query(IncidentReport).filter(IncidentReport.id == rid).first()
    if not r:
        raise HTTPException(404, "보고서를 찾을 수 없습니다.")
    if body.type in TYPES:
        r.type = body.type
    if body.severity in SEVERITIES:
        r.severity = body.severity
    if _D.match(body.occurred_date or ""):
        r.occurred_date = body.occurred_date
    r.occurred_time = body.occurred_time or r.occurred_time
    for f in ("resident_id", "resident_name", "location", "description",
              "action", "follow_up", "guardian_method", "guardian_note"):
        v = getattr(body, f)
        if v is not None:
            setattr(r, f, v.strip() if isinstance(v, str) else v)
    if body.guardian_notified is not None:
        was = bool(r.guardian_notified)
        r.guardian_notified = bool(body.guardian_notified)
        if body.guardian_notified and not was:
            r.guardian_notified_at = now_kst()   # 처음 안내한 시각을 남긴다
        if not body.guardian_notified:
            r.guardian_notified_at = None
    if body.status in ("open", "closed"):
        r.status = body.status
    db.commit()
    return ApiResponse(success=True, data=_view(r))


@router.delete("/{rid}")
def delete_incident(rid: str, db: Session = Depends(get_db),
                    current_user: User = Depends(_writer)):
    r = db.query(IncidentReport).filter(IncidentReport.id == rid).first()
    if not r:
        raise HTTPException(404, "보고서를 찾을 수 없습니다.")
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제했습니다.")


@router.get("/candidates")
def handover_candidates(days: int = 7, db: Session = Depends(get_db),
                        _: User = Depends(_writer)):
    """인수인계 AI가 잡은 사고 후보 — 최근 며칠의 urgency=high 항목.

    이미 보고서로 만든 항목(handover_ref)은 빼고 보여줘서 이중 등록을 막는다."""
    since = now_kst() - timedelta(days=max(1, min(days, 31)))
    reports = (db.query(HandoverReport)
               .filter(HandoverReport.created_at >= since)
               .order_by(HandoverReport.created_at.desc()).limit(30).all())
    done = {r.handover_ref for r in db.query(IncidentReport)
            .filter(IncidentReport.handover_ref.isnot(None)).all()}
    out = []
    for rep in reports:
        entries = ((rep.report or {}).get("entries")) or []
        for i, e in enumerate(entries):
            if str(e.get("urgency") or "").lower() != "high":
                continue
            ref = f"{rep.id}:{i}"
            if ref in done:
                continue
            out.append({
                "handover_ref": ref,
                # 항목에 날짜가 적혀 있으면 그 날짜, 없으면 리포트 생성일
                "date": (e.get("date") or "").strip()
                        or (rep.created_at.strftime("%Y-%m-%d") if rep.created_at else None),
                "time": e.get("time") or None,
                "resident_id": e.get("resident_id"),
                "resident_name": e.get("resident_matched") or e.get("resident"),
                "category": e.get("category") or "기타",
                "suggested_type": HANDOVER_TYPE.get(e.get("category") or "", "기타"),
                "note": e.get("content") or "",
            })
    return ApiResponse(success=True, data=out[:50])
