"""간호기록 점검 (케어포 3. 간호 급여제공 판정 결과) API.

외부 루틴(Aside, carefor-nursing-audit 스킬)이 케어포 간호기록을 규칙으로 판정한 결과를
월 단위로 올리면 admin 은 저장·조회·표시만 한다 — 판정 로직은 여기 없다.
같은 month 로 다시 올리면 덮어쓴다(upsert). 주별 조회는 월 스냅샷을 날짜로 잘라 요약을 다시 계산한다.

권한: 조회·업로드·삭제 모두 관리자급(role ADMIN 또는 position 시설장). 사용자 지시 2026-09-26 "시설장도 볼 수 있게".
App.tsx 의 ManagerRoute 와 같은 기준이어야 한다.
"""
from __future__ import annotations
import re
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.nursing_audit import NursingAudit, now_kst
from app.schemas.response import ApiResponse
from app.services.nursing_audit import build_summary, slice_by_date, validate_findings

router = APIRouter()


def _manager(current_user: User = Depends(get_current_user)) -> User:
    """관리자급 — ADMIN 또는 시설장(직원 계정이어도). 조회·업로드·삭제가 같은 문을 쓴다."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "간호기록 점검은 관리자·시설장만 볼 수 있습니다.")
    return current_user

MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class NursingAuditBody(BaseModel):
    window_start: str
    window_end: str
    generated_at: Optional[str] = None
    source: Optional[str] = None
    coverage: Optional[dict] = None
    summary: Optional[dict] = None
    findings: Optional[list] = None
    home_nursing: Optional[list] = None


def _month_view(a: NursingAudit) -> dict[str, Any]:
    s = a.summary or {}
    return {
        "month": a.month, "window_start": a.window_start, "window_end": a.window_end,
        "generated_at": a.generated_at.isoformat() if a.generated_at else None,
        "total": s.get("total", 0), "by_kind": s.get("by_kind", {}), "uploaded_by": a.uploaded_by,
    }


def _detail(a: NursingAudit) -> dict[str, Any]:
    return {
        "month": a.month, "window_start": a.window_start, "window_end": a.window_end,
        "generated_at": a.generated_at.isoformat() if a.generated_at else None,
        "source": a.source, "coverage": a.coverage or {}, "summary": a.summary or {},
        "findings": a.findings or [], "home_nursing": a.home_nursing or [], "uploaded_by": a.uploaded_by,
    }


@router.get("/months")
def list_months(db: Session = Depends(get_db), _: User = Depends(_manager)):
    """점검 월 목록 — 최신 우선."""
    rows = db.query(NursingAudit).order_by(NursingAudit.month.desc()).all()
    return ApiResponse(success=True, data=[_month_view(r) for r in rows])


@router.get("/latest")
def latest(db: Session = Depends(get_db), _: User = Depends(_manager)):
    row = db.query(NursingAudit).order_by(NursingAudit.month.desc()).first()
    if not row:
        return ApiResponse(success=True, data=None)
    return ApiResponse(success=True, data=_month_view(row))


@router.get("/range")
def get_range(start: str = Query(...), end: str = Query(...),
              db: Session = Depends(get_db), _: User = Depends(_manager)):
    """날짜 구간(주별 화면용) — 겹치는 월 스냅샷의 findings 를 잘라 붙이고 요약을 다시 만든다."""
    if not DATE_RE.match(start) or not DATE_RE.match(end) or start > end:
        raise HTTPException(400, "start/end 는 YYYY-MM-DD 이고 start ≤ end 여야 합니다.")
    months = sorted({start[:7], end[:7]})
    rows = (db.query(NursingAudit).filter(NursingAudit.month >= months[0], NursingAudit.month <= months[-1])
            .order_by(NursingAudit.month.asc()).all())
    if not rows:
        raise HTTPException(404, "그 기간의 점검 결과가 없습니다.")
    findings: list[dict] = []
    home: list[dict] = []
    covered_start, covered_end = None, None
    notes: list[str] = []
    residents = 0
    generated = None
    for r in rows:
        findings += slice_by_date(r.findings or [], start, end)
        home += slice_by_date(r.home_nursing or [], start, end)
        covered_start = r.window_start if covered_start is None else min(covered_start, r.window_start)
        covered_end = r.window_end if covered_end is None else max(covered_end, r.window_end)
        residents = max(residents, int((r.coverage or {}).get("residents") or 0))
        notes += [n for n in ((r.coverage or {}).get("notes") or []) if isinstance(n, str)]
        if r.generated_at and (generated is None or r.generated_at > generated):
            generated = r.generated_at
    eff_start, eff_end = max(start, covered_start or start), min(end, covered_end or end)
    if eff_start > eff_end:
        raise HTTPException(404, "그 기간의 점검 결과가 없습니다.")
    if eff_start != start or eff_end != end:
        notes.insert(0, f"점검된 구간은 {eff_start} ~ {eff_end} 입니다(나머지 날짜는 아직 점검 전).")
    return ApiResponse(success=True, data={
        "window_start": eff_start, "window_end": eff_end, "requested_start": start, "requested_end": end,
        "generated_at": generated.isoformat() if generated else None,
        "source": rows[-1].source,
        "coverage": {"residents": residents, "dates": _count_days(eff_start, eff_end), "notes": notes},
        "summary": build_summary(findings, home), "findings": findings, "home_nursing": home,
        "months": [r.month for r in rows],
    })


def _count_days(a: str, b: str) -> int:
    try:
        return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).days + 1
    except ValueError:
        return 0


@router.get("/months/{month}")
def get_month(month: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    row = db.query(NursingAudit).filter(NursingAudit.month == month).first()
    if not row:
        raise HTTPException(404, "그 달 점검 결과가 없습니다.")
    return ApiResponse(success=True, data=_detail(row))


@router.put("/months/{month}")
def upsert_month(month: str, body: NursingAuditBody, db: Session = Depends(get_db),
                 current_user: User = Depends(_manager)):
    if not MONTH_RE.match(month):
        raise HTTPException(400, "month 는 YYYY-MM 형식이어야 합니다.")
    for k in ("window_start", "window_end"):
        v = getattr(body, k) or ""
        if not DATE_RE.match(v) or v[:7] != month:
            raise HTTPException(400, f"{k} 는 {month} 안의 YYYY-MM-DD 여야 합니다.")
    errors = validate_findings(body.findings)
    if errors:
        raise HTTPException(400, "findings 검증 실패: " + " / ".join(errors[:5]))
    summary = body.summary or build_summary(body.findings or [], body.home_nursing or [])
    generated_at = None
    if body.generated_at:
        try:
            generated_at = datetime.fromisoformat(body.generated_at)
        except ValueError:
            raise HTTPException(400, "generated_at 은 ISO 형식이어야 합니다.")
    row = db.query(NursingAudit).filter(NursingAudit.month == month).first()
    if not row:
        row = NursingAudit(month=month)
        db.add(row)
    row.window_start = body.window_start
    row.window_end = body.window_end
    row.generated_at = generated_at or now_kst()
    row.source = body.source
    row.coverage = body.coverage or {}
    row.summary = summary
    row.findings = body.findings or []
    row.home_nursing = body.home_nursing or []
    row.uploaded_by = getattr(current_user, "name", None)
    row.updated_at = now_kst()
    db.commit()
    db.refresh(row)
    return ApiResponse(success=True, data={"month": row.month, "window_start": row.window_start,
                                           "window_end": row.window_end, "total": summary.get("total", 0),
                                           "findings_stored": len(row.findings or [])})


@router.delete("/months/{month}")
def delete_month(month: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    row = db.query(NursingAudit).filter(NursingAudit.month == month).first()
    if not row:
        raise HTTPException(404, "그 달 점검 결과가 없습니다.")
    db.delete(row)
    db.commit()
    return ApiResponse(success=True, message="삭제했습니다.")
