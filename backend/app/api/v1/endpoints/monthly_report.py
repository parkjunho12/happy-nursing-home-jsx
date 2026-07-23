"""월간 운영 리포트 — 입소·인력·서류·지출·사고를 한 장으로.

시설장이 매달 손으로 모으던 숫자를 자동 집계한다.
화면에서 인쇄(PDF 저장)하는 방식 — 근무표 인쇄와 같은 패턴.
권한: ADMIN · 시설장 · 대표 · 이사
"""
from __future__ import annotations
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcResident, LtcStaffMember
from app.models.expense import ExpenseRequest
from app.models.incident import IncidentReport
from app.models.leave import LeaveRequest
from app.models.visit import VisitReservation
from app.schemas.response import ApiResponse

router = APIRouter()
_M = re.compile(r"^\d{4}-\d{2}$")


def _viewer(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "대표", "이사"):
        raise HTTPException(403, "운영 리포트 열람 권한이 없습니다.")
    return current_user


def _month_end(month: str) -> str:
    import calendar
    y, m = int(month[:4]), int(month[5:7])
    return f"{month}-{calendar.monthrange(y, m)[1]:02d}"


@router.get("/monthly")
def monthly_report(month: str, db: Session = Depends(get_db), _: User = Depends(_viewer)):
    if not _M.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    m_start, m_end = f"{month}-01", _month_end(month)

    # ── 입소 현황 — 월말 기준 재원 + 그달의 입·퇴소 ──
    residents = db.query(LtcResident).all()
    def _in_house(r) -> bool:
        adm = (r.admission_date or "")[:10]
        dis = (r.discharge_date or "")[:10]
        return bool(adm) and adm <= m_end and (not dis or dis > m_end)
    in_house = [r for r in residents if _in_house(r)]
    admissions = [r for r in residents if m_start <= (r.admission_date or "")[:10] <= m_end]
    discharges = [r for r in residents if r.discharge_date and m_start <= r.discharge_date[:10] <= m_end]
    by_floor: dict = {}
    for r in in_house:
        by_floor[r.floor or "미지정"] = by_floor.get(r.floor or "미지정", 0) + 1

    # ── 인력 — 월말 기준 재직 + 그달의 입·퇴사 ──
    staff = db.query(LtcStaffMember).all()
    def _employed(s) -> bool:
        h = (s.hire_date or "")[:10]
        rd = (getattr(s, "resign_date", None) or "")[:10]
        return bool(h) and h <= m_end and (not rd or rd > m_end)
    employed = [s for s in staff if _employed(s)]
    hires = [s for s in staff if m_start <= (s.hire_date or "")[:10] <= m_end]
    resigns = [s for s in staff if (getattr(s, "resign_date", None) or "")
               and m_start <= (getattr(s, "resign_date") or "")[:10] <= m_end]
    by_position: dict = {}
    for s in employed:
        by_position[s.position or "미지정"] = by_position.get(s.position or "미지정", 0) + 1
    caregivers = by_position.get("요양보호사", 0)
    # 인력배치 2.5:1 — 시설 배치 기준 감(정확한 판정은 인력배치 시뮬레이터)
    ratio = round(len(in_house) / caregivers, 2) if caregivers else None

    # ── 서류 — 인정서 만료 임박(다음 90일) ──
    from app.models.resident_docs import ResidentDocStatus
    expiring = []
    try:
        from datetime import date, timedelta
        horizon = (date.fromisoformat(m_end) + timedelta(days=90)).isoformat()
        for d in db.query(ResidentDocStatus).all():
            for c in (d.certifications or []):
                end = (c.get("end") or "")[:10]
                if end and m_end < end <= horizon:
                    expiring.append({"name": getattr(d, "name", None) or "",
                                     "end": end, "grade": c.get("grade")})
    except Exception:
        pass
    expiring.sort(key=lambda x: x["end"])

    # ── 지출 — 승인 기준, 계정과목별 ──
    expenses = db.query(ExpenseRequest).filter(
        ExpenseRequest.status == "approved",
        ExpenseRequest.purchased_at >= m_start, ExpenseRequest.purchased_at <= m_end).all()
    exp_by_cat: dict = {}
    for e in expenses:
        exp_by_cat[e.category or "기타"] = exp_by_cat.get(e.category or "기타", 0) + (e.amount or 0)

    # ── 사고 — 유형별 + 보호자 안내율 ──
    incidents = db.query(IncidentReport).filter(
        IncidentReport.occurred_date >= m_start,
        IncidentReport.occurred_date <= m_end).all()
    inc_by_type: dict = {}
    for i in incidents:
        inc_by_type[i.type] = inc_by_type.get(i.type, 0) + 1
    notified = sum(1 for i in incidents if i.guardian_notified)

    # ── 활동 — 승인 연차·면회 ──
    annual_used = db.query(LeaveRequest).filter(
        LeaveRequest.kind == "연차", LeaveRequest.status == "approved",
        LeaveRequest.date.like(f"{month}-%")).count()
    visits = db.query(VisitReservation).filter(
        VisitReservation.status == "approved",
        VisitReservation.date.like(f"{month}-%")).count()

    return ApiResponse(success=True, data={
        "month": month,
        "residents": {
            "in_house": len(in_house), "admissions": len(admissions),
            "discharges": len(discharges), "by_floor": by_floor,
            "admission_names": [r.name for r in admissions],
            "discharge_names": [r.name for r in discharges],
        },
        "staff": {
            "employed": len(employed), "hires": len(hires), "resigns": len(resigns),
            "by_position": by_position, "caregivers": caregivers, "ratio": ratio,
            "hire_names": [s.name for s in hires], "resign_names": [s.name for s in resigns],
        },
        "docs": {"expiring_90d": expiring[:20]},
        "expense": {"total": sum(exp_by_cat.values()), "by_category": exp_by_cat,
                    "count": len(expenses)},
        "incidents": {"total": len(incidents), "by_type": inc_by_type,
                      "guardian_notified": notified},
        "activity": {"annual_used": annual_used, "visits_approved": visits},
    })
