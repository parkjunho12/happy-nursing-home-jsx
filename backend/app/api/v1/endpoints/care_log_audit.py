"""주간 급여제공 기록지 점검 (케어포 판정 결과) API.

외부 루틴(Aside)이 케어포 기록을 규칙으로 판정한 결과를 올리면 admin 은
저장·조회·표시만 한다 — 판정 로직은 여기 없다. 같은 week_start 로 다시
올리면 덮어쓴다(upsert).

권한: 조회·업로드·삭제 모두 role ADMIN 계정만(직원 개인별 오류 집계라 관리자 외에는 보이지 않는다).
"""
from __future__ import annotations
import re
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.user import User
from app.models.care_log_audit import CareLogAudit, now_kst
from app.schemas.response import ApiResponse
from app.services.care_log_audit import build_summary, top_staff, validate_findings

router = APIRouter()

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _editor(current_user: User = Depends(get_current_admin_user)) -> User:
    """업로드·삭제 — ADMIN 만. 조회도 같은 문(get_current_admin_user)을 쓴다."""
    return current_user


class CareLogAuditBody(BaseModel):
    week_end: str
    generated_at: Optional[str] = None
    source: Optional[str] = None
    coverage: Optional[dict] = None
    summary: Optional[dict] = None
    findings: Optional[list] = None
    staff_workload: Optional[list] = None


def _week_view(a: CareLogAudit) -> dict[str, Any]:
    return {
        "week_start": a.week_start,
        "week_end": a.week_end,
        "generated_at": a.generated_at.isoformat() if a.generated_at else None,
        "total": (a.summary or {}).get("total", 0),
        "by_kind": (a.summary or {}).get("by_kind", {}),
        "uploaded_by": a.uploaded_by,
    }


def _week_detail(a: CareLogAudit) -> dict[str, Any]:
    return {
        "week_start": a.week_start,
        "week_end": a.week_end,
        "generated_at": a.generated_at.isoformat() if a.generated_at else None,
        "source": a.source,
        "coverage": a.coverage or {},
        "summary": a.summary or {},
        "findings": a.findings or [],
        "staff_workload": a.staff_workload or [],
        "uploaded_by": a.uploaded_by,
    }


@router.get("/weeks")
def list_weeks(db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    """점검 주 목록 — 최신 우선."""
    rows = (db.query(CareLogAudit)
            .order_by(CareLogAudit.week_start.desc()).all())
    return ApiResponse(success=True, data=[_week_view(r) for r in rows])


@router.get("/latest")
def latest(db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    """최신 주 요약 — 대시보드 카드용. 없으면 null."""
    row = (db.query(CareLogAudit)
           .order_by(CareLogAudit.week_start.desc()).first())
    if not row:
        return ApiResponse(success=True, data=None)
    summary = row.summary or {}
    return ApiResponse(success=True, data={
        "week_start": row.week_start,
        "week_end": row.week_end,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "total": summary.get("total", 0),
        "by_kind": summary.get("by_kind", {}),
        "top_staff": top_staff(summary, 3),
        "by_area": summary.get("by_area", {}),
    })


@router.get("/weeks/{week_start}")
def get_week(week_start: str, db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    row = db.query(CareLogAudit).filter(CareLogAudit.week_start == week_start).first()
    if not row:
        raise HTTPException(404, "그 주 점검 결과가 없습니다.")
    return ApiResponse(success=True, data=_week_detail(row))


@router.put("/weeks/{week_start}")
def upsert_week(week_start: str, body: CareLogAuditBody, db: Session = Depends(get_db),
                 current_user: User = Depends(_editor)):
    if not DATE_RE.match(week_start):
        raise HTTPException(400, "week_start 는 YYYY-MM-DD 형식이어야 합니다.")
    if not DATE_RE.match(body.week_end or ""):
        raise HTTPException(400, "week_end 는 YYYY-MM-DD 형식이어야 합니다.")

    errors = validate_findings(body.findings)
    if errors:
        raise HTTPException(400, "findings 검증 실패: " + " / ".join(errors[:5]))

    summary = body.summary or {}
    if not summary:
        summary = build_summary(body.findings)

    generated_at = None
    if body.generated_at:
        try:
            generated_at = datetime.fromisoformat(body.generated_at)
        except ValueError:
            raise HTTPException(400, "generated_at 은 ISO 형식이어야 합니다.")

    row = db.query(CareLogAudit).filter(CareLogAudit.week_start == week_start).first()
    if not row:
        row = CareLogAudit(week_start=week_start)
        db.add(row)

    row.week_end = body.week_end
    row.generated_at = generated_at or now_kst()
    row.source = body.source
    row.coverage = body.coverage or {}
    row.summary = summary
    row.findings = body.findings or []
    row.staff_workload = body.staff_workload or []
    row.uploaded_by = getattr(current_user, "name", None)
    row.updated_at = now_kst()
    db.commit()
    db.refresh(row)

    return ApiResponse(success=True, data={
        "week_start": row.week_start,
        "week_end": row.week_end,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "total": summary.get("total", 0),
    })


@router.delete("/weeks/{week_start}")
def delete_week(week_start: str, db: Session = Depends(get_db), _: User = Depends(_editor)):
    row = db.query(CareLogAudit).filter(CareLogAudit.week_start == week_start).first()
    if not row:
        raise HTTPException(404, "그 주 점검 결과가 없습니다.")
    db.delete(row)
    db.commit()
    return ApiResponse(success=True, message="삭제했습니다.")
