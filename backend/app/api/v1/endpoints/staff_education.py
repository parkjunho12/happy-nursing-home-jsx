"""직원 법정·평가 의무교육 — 조회: 전 직원 / 등록·수정: ADMIN · 사회복지사 · 시설장"""
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staff_education import StaffEducation, now_kst
from app.schemas.response import ApiResponse
from app.services.edu_plan import plan_rows

router = APIRouter()

DIVISIONS = ("평가", "법정", "기타")
WRITE_POSITIONS = ("사회복지사", "시설장")


def _require_writer(current_user: User = Depends(get_current_user)) -> User:
    """등록·수정 권한: ADMIN · 사회복지사 · 시설장"""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos not in WRITE_POSITIONS:
        raise HTTPException(403, "교육 기록 권한이 없습니다. (관리자·사회복지사·시설장)")
    return current_user


def _view(e: StaffEducation) -> dict:
    return {
        "id": e.id, "year": e.year, "month": e.month, "sort": e.sort or 0,
        "division": e.division or "기타", "eval_no": e.eval_no, "topic": e.topic,
        "title": e.title, "org": e.org, "requirement": e.requirement,
        "done": bool(e.done), "plan_date": e.plan_date, "done_date": e.done_date,
        "instructor": e.instructor, "attendee_count": e.attendee_count,
        "attendees": e.attendees, "material": e.material, "memo": e.memo,
        "updated_by_name": e.updated_by_name,
    }


class EduBody(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
    division: Optional[str] = None
    eval_no: Optional[str] = None
    topic: Optional[str] = None
    title: Optional[str] = None
    org: Optional[str] = None
    requirement: Optional[str] = None
    done: Optional[bool] = None
    plan_date: Optional[str] = None
    done_date: Optional[str] = None
    instructor: Optional[str] = None
    attendee_count: Optional[int] = None
    attendees: Optional[str] = None
    material: Optional[str] = None
    memo: Optional[str] = None
    sort: Optional[int] = None


def _apply(e: StaffEducation, b: EduBody, user: User) -> None:
    def s(v: Optional[str]) -> Optional[str]:
        return (v or "").strip() or None

    if b.year is not None: e.year = int(b.year)
    if b.month is not None: e.month = max(1, min(12, int(b.month)))
    if b.division is not None: e.division = b.division if b.division in DIVISIONS else "기타"
    if b.eval_no is not None: e.eval_no = s(b.eval_no)
    if b.topic is not None: e.topic = s(b.topic)
    if b.title is not None: e.title = s(b.title) or e.title
    if b.org is not None: e.org = s(b.org)
    if b.requirement is not None: e.requirement = s(b.requirement)
    if b.plan_date is not None: e.plan_date = s(b.plan_date)
    if b.instructor is not None: e.instructor = s(b.instructor)
    if b.attendee_count is not None: e.attendee_count = b.attendee_count
    if b.attendees is not None: e.attendees = s(b.attendees)
    if b.material is not None: e.material = s(b.material)
    if b.memo is not None: e.memo = s(b.memo)
    if b.sort is not None: e.sort = int(b.sort)

    if b.done_date is not None:
        e.done_date = s(b.done_date)
    if b.done is not None:
        e.done = bool(b.done)
        # 완료로 표시했는데 실시일이 없으면 오늘로 채운다 (기록 누락 방지)
        if e.done and not e.done_date:
            e.done_date = now_kst().date().isoformat()
        if not e.done:
            e.done_date = None

    e.updated_by_name = getattr(user, "name", None)
    e.updated_at = now_kst()


@router.get("")
def list_educations(
    year: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),   # 조회는 전 직원
):
    rows = (db.query(StaffEducation)
            .filter(StaffEducation.year == year, StaffEducation.active == True)  # noqa: E712
            .all())
    rows.sort(key=lambda e: (e.month or 0, e.sort or 0, e.title or ""))
    return ApiResponse(success=True, data=[_view(e) for e in rows])


@router.get("/summary")
def summary(year: int = Query(...), db: Session = Depends(get_db),
            _: User = Depends(get_current_user)):
    """연간/월별 이수 현황."""
    rows = (db.query(StaffEducation)
            .filter(StaffEducation.year == year, StaffEducation.active == True).all())  # noqa: E712
    total = len(rows)
    done = sum(1 for e in rows if e.done)
    by_division = {}
    for d in DIVISIONS:
        sub = [e for e in rows if (e.division or "기타") == d]
        by_division[d] = {"total": len(sub), "done": sum(1 for e in sub if e.done)}
    by_month = {}
    for m in range(1, 13):
        sub = [e for e in rows if e.month == m]
        if sub:
            by_month[m] = {"total": len(sub), "done": sum(1 for e in sub if e.done)}
    return ApiResponse(success=True, data={
        "year": year, "total": total, "done": done,
        "rate": round(done / total * 100) if total else 0,
        "by_division": by_division, "by_month": by_month,
    })


@router.post("/seed")
def seed_plan(year: int = Query(...), db: Session = Depends(get_db),
              _: User = Depends(_require_writer)):
    """연간 계획표를 DB에 채운다. 이미 있는 교육(같은 연·월·교육명)은 건드리지 않음 → 실시 기록 보존."""
    existing = {(e.month, (e.title or "").strip())
                for e in db.query(StaffEducation).filter(StaffEducation.year == year).all()}
    added = 0
    for r in plan_rows(year):
        key = (r["month"], (r["title"] or "").strip())
        if key in existing:
            continue
        db.add(StaffEducation(**r, done=False, active=True))
        added += 1
    db.commit()
    return ApiResponse(success=True, data={"added": added, "skipped": len(existing)},
                       message=f"{added}건을 계획에 추가했습니다." if added else "이미 최신 계획입니다.")


@router.post("", status_code=201)
def create_education(b: EduBody, db: Session = Depends(get_db),
                     current_user: User = Depends(_require_writer)):
    if not (b.title or "").strip():
        raise HTTPException(400, "교육명을 입력해주세요.")
    if not b.year or not b.month:
        raise HTTPException(400, "연도와 월을 입력해주세요.")
    e = StaffEducation(year=int(b.year), month=int(b.month), title=b.title.strip(), active=True)
    _apply(e, b, current_user)
    db.add(e); db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e))


@router.patch("/{eid}")
def update_education(eid: str, b: EduBody, db: Session = Depends(get_db),
                     current_user: User = Depends(_require_writer)):
    e = db.query(StaffEducation).filter(StaffEducation.id == eid).first()
    if not e:
        raise HTTPException(404, "교육을 찾을 수 없습니다.")
    _apply(e, b, current_user)
    db.commit(); db.refresh(e)
    return ApiResponse(success=True, data=_view(e))


@router.delete("/{eid}")
def delete_education(eid: str, db: Session = Depends(get_db),
                     _: User = Depends(_require_writer)):
    e = db.query(StaffEducation).filter(StaffEducation.id == eid).first()
    if not e:
        raise HTTPException(404, "교육을 찾을 수 없습니다.")
    db.delete(e); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")
