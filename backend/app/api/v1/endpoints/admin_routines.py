"""ADMIN 전용 월간 업무 — 매달 반복되는 일을 규칙으로 등록해두고 달마다 완료를 체크한다.

권한: role=ADMIN만. 시설장·대표·이사도 볼 수 없다(요청 사양).
"""
from __future__ import annotations

import calendar
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.admin_routine import AdminRoutine, AdminRoutineDone, now_kst
from app.schemas.response import ApiResponse

router = APIRouter()

_KST = timezone(timedelta(hours=9))

CATEGORIES = ["신고·납부", "급여", "보고", "점검", "기타"]

# 처음 열었을 때 빈 화면이 아니도록 — 장기요양기관에서 매달 돌아오는 대표 업무들.
# 날짜·내용은 시설마다 다르니 등록 후 수정해서 쓰라는 전제의 출발점이다.
DEFAULT_ROUTINES = [
    {"day": 5,  "category": "보고",     "title": "전월 근무표·근무기록 마감 확인",   "memo": ""},
    {"day": 10, "category": "신고·납부", "title": "원천세 신고·납부",                "memo": "홈택스 — 전월 급여분"},
    {"day": 10, "category": "신고·납부", "title": "4대보험 보험료 납부",             "memo": "4대사회보험 정보연계센터"},
    {"day": 15, "category": "신고·납부", "title": "입·퇴사자 4대보험 취득·상실 신고", "memo": "변동 있을 때만"},
    {"day": 20, "category": "보고",     "title": "장기요양급여비용 청구",            "memo": "공단 요양기관정보마당"},
    {"day": 25, "category": "급여",     "title": "급여 계산·이체",                   "memo": ""},
    {"day": 25, "category": "급여",     "title": "급여명세서 교부",                  "memo": "법정 의무 — 교부 기록 남기기"},
    {"day": 31, "category": "점검",     "title": "월말 지출결의·통장 대사",          "memo": "말일 기준"},
]


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    return current_user


def _this_month() -> str:
    return datetime.now(_KST).strftime("%Y-%m")


def _parse_month(month: Optional[str]) -> tuple[int, int, str]:
    """'YYYY-MM' → (연, 월, 정규화된 키). 형식이 틀리면 이번 달."""
    if month:
        try:
            y, m = month.split("-")
            y, m = int(y), int(m)
            if 1 <= m <= 12 and 2000 <= y <= 2999:
                return y, m, f"{y:04d}-{m:02d}"
        except (ValueError, AttributeError):
            pass
    now = datetime.now(_KST)
    return now.year, now.month, now.strftime("%Y-%m")


def _date_in_month(year: int, month: int, day: int) -> str:
    """그 달에 없는 날(2월 30일 등)은 말일로 당긴다 — 31일 지정 = 매월 말일."""
    last = calendar.monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-{min(max(day, 1), last):02d}"


@router.get("")
def list_routines(
    month: Optional[str] = Query(None, description="YYYY-MM — 생략 시 이번 달"),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """그 달에 해야 할 업무 목록 — 날짜순. 완료 여부는 그 달 기록만 본다."""
    year, mon, period = _parse_month(month)

    q = db.query(AdminRoutine)
    if not include_inactive:
        q = q.filter(AdminRoutine.active == True)  # noqa: E712
    rows = q.all()

    dones = {
        d.routine_id: d
        for d in db.query(AdminRoutineDone).filter(AdminRoutineDone.period_key == period).all()
    }

    today = datetime.now(_KST).strftime("%Y-%m-%d")
    items = []
    for r in rows:
        date = _date_in_month(year, mon, r.day or 1)
        done = dones.get(r.id)
        items.append({
            "id": r.id,
            "title": r.title,
            "day": r.day,
            "date": date,
            "category": r.category,
            "memo": r.memo,
            "active": bool(r.active),
            "sort": r.sort,
            "done": done is not None,
            "done_date": done.done_date if done else None,
            "done_by": done.done_by if done else None,
            "done_memo": done.memo if done else None,
            # 기한이 지났는데 아직 안 한 것 — 화면에서 빨갛게 띄운다
            "overdue": done is None and date < today,
        })
    items.sort(key=lambda i: (i["date"], i["sort"], i["title"]))

    return ApiResponse(success=True, data={
        "month": period,
        "today": today,
        "items": items,
        "total": len(items),
        "done_count": sum(1 for i in items if i["done"]),
    })


class RoutineBody(BaseModel):
    title: str
    day: int = 1
    category: str = "기타"
    memo: Optional[str] = None
    sort: Optional[int] = None
    active: Optional[bool] = None


@router.post("")
def create_routine(body: RoutineBody, db: Session = Depends(get_db),
                   current_user: User = Depends(_require_admin)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="업무명을 입력해주세요.")
    r = AdminRoutine(
        title=body.title.strip(),
        day=min(max(body.day, 1), 31),
        category=body.category if body.category in CATEGORIES else "기타",
        memo=(body.memo or "").strip() or None,
        sort=body.sort or 0,
        active=True if body.active is None else bool(body.active),
    )
    db.add(r); db.commit(); db.refresh(r)
    return ApiResponse(success=True, data={"id": r.id})


class RoutineUpdate(BaseModel):
    title: Optional[str] = None
    day: Optional[int] = None
    category: Optional[str] = None
    memo: Optional[str] = None
    sort: Optional[int] = None
    active: Optional[bool] = None


@router.patch("/{rid}")
def update_routine(rid: str, body: RoutineUpdate, db: Session = Depends(get_db),
                   current_user: User = Depends(_require_admin)):
    r = db.query(AdminRoutine).filter(AdminRoutine.id == rid).first()
    if not r:
        raise HTTPException(status_code=404, detail="업무를 찾을 수 없습니다.")
    if body.title is not None and body.title.strip():
        r.title = body.title.strip()
    if body.day is not None:
        r.day = min(max(body.day, 1), 31)
    if body.category is not None and body.category in CATEGORIES:
        r.category = body.category
    if body.memo is not None:
        r.memo = body.memo.strip() or None
    if body.sort is not None:
        r.sort = body.sort
    if body.active is not None:
        r.active = bool(body.active)
    r.updated_at = now_kst()
    db.commit()
    return ApiResponse(success=True, message="저장되었습니다.")


@router.delete("/{rid}")
def delete_routine(rid: str, db: Session = Depends(get_db),
                   current_user: User = Depends(_require_admin)):
    r = db.query(AdminRoutine).filter(AdminRoutine.id == rid).first()
    if not r:
        raise HTTPException(status_code=404, detail="업무를 찾을 수 없습니다.")
    # 규칙이 사라지면 지난 달 완료 기록도 볼 일이 없다 — 같이 정리한다
    db.query(AdminRoutineDone).filter(AdminRoutineDone.routine_id == rid).delete()
    db.delete(r); db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


class DoneBody(BaseModel):
    month: Optional[str] = None     # 'YYYY-MM' — 생략 시 이번 달
    done: bool = True
    done_date: Optional[str] = None  # 실제 처리한 날 — 생략 시 오늘
    memo: Optional[str] = None


@router.post("/{rid}/done")
def toggle_done(rid: str, body: DoneBody, db: Session = Depends(get_db),
                current_user: User = Depends(_require_admin)):
    """그 달의 완료 체크 — 다음 달에는 다시 미완료로 뜬다."""
    r = db.query(AdminRoutine).filter(AdminRoutine.id == rid).first()
    if not r:
        raise HTTPException(status_code=404, detail="업무를 찾을 수 없습니다.")
    _, _, period = _parse_month(body.month)

    rec = (db.query(AdminRoutineDone)
             .filter(AdminRoutineDone.routine_id == rid,
                     AdminRoutineDone.period_key == period).first())

    if not body.done:
        if rec:
            db.delete(rec); db.commit()
        return ApiResponse(success=True, data={"done": False})

    today = datetime.now(_KST).strftime("%Y-%m-%d")
    if rec:
        rec.done_date = body.done_date or rec.done_date or today
        rec.memo = (body.memo or "").strip() or rec.memo
    else:
        rec = AdminRoutineDone(
            routine_id=rid, period_key=period,
            done_date=body.done_date or today,
            done_by=getattr(current_user, "name", None),
            memo=(body.memo or "").strip() or None,
        )
        db.add(rec)
    db.commit()
    return ApiResponse(success=True, data={
        "done": True, "done_date": rec.done_date, "done_by": rec.done_by,
    })


@router.post("/seed-defaults")
def seed_defaults(db: Session = Depends(get_db), current_user: User = Depends(_require_admin)):
    """기본 항목 채우기 — 이미 등록된 업무가 있으면 아무것도 하지 않는다."""
    if db.query(AdminRoutine).count() > 0:
        raise HTTPException(status_code=400, detail="이미 등록된 업무가 있습니다.")
    for i, d in enumerate(DEFAULT_ROUTINES):
        db.add(AdminRoutine(title=d["title"], day=d["day"], category=d["category"],
                            memo=d["memo"] or None, sort=i))
    db.commit()
    return ApiResponse(success=True, message=f"{len(DEFAULT_ROUTINES)}건을 추가했습니다.")
