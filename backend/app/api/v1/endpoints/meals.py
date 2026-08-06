"""주간 식단표 API — 엑셀 업로드 → 주간/월간 보기.

권한: 업로드 ADMIN·시설장·사회복지사·대표·이사 / 조회 로그인 직원 전체.
"""
from __future__ import annotations
import re
from datetime import date, timedelta
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.meal import MealWeek, MealTimeSetting
from app.schemas.response import ApiResponse

router = APIRouter()
_YM = re.compile(r"^\d{4}-\d{2}$")
_YMD = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _editor(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "사회복지사", "대표", "이사", "영양사"):
        raise HTTPException(403, "식단표 관리 권한이 없습니다.")
    return current_user


def _view(row: MealWeek) -> dict:
    return {"start": row.start, "end": row.end, "days": row.days or {},
            "notes": row.notes or [], "updated_by": row.updated_by,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.post("/upload")
async def upload_meal(file: UploadFile = File(...), db: Session = Depends(get_db),
                      current_user: User = Depends(_editor)):
    """주간식단표 엑셀 업로드 — 같은 주(시작일)는 교체."""
    data = await file.read()
    from app.services.meal_parser import parse_meal_xlsx
    try:
        parsed = parse_meal_xlsx(data)
    except Exception as e:
        raise HTTPException(400, f"식단표 파싱 실패: {e}")
    row = db.query(MealWeek).filter(MealWeek.start == parsed["start"]).first()
    if not row:
        row = MealWeek(start=parsed["start"])
        db.add(row)
    row.end = parsed["end"]
    row.days = parsed["days"]
    row.notes = parsed["notes"]
    row.updated_by = getattr(current_user, "name", None)
    db.commit()
    return ApiResponse(success=True, data={"start": parsed["start"], "end": parsed["end"],
                                           "day_count": len(parsed["days"])})


MEAL_TIME_FIELDS = ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"]


def _meal_times(db: Session) -> dict:
    row = db.query(MealTimeSetting).first()
    return {k: (getattr(row, k, None) if row else None) for k in MEAL_TIME_FIELDS}


@router.get("/settings")
def get_meal_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ApiResponse(success=True, data=_meal_times(db))


from pydantic import BaseModel
from typing import Optional as _Opt


class MealTimesBody(BaseModel):
    breakfast: _Opt[str] = None
    snack_am: _Opt[str] = None
    lunch: _Opt[str] = None
    snack_pm: _Opt[str] = None
    dinner: _Opt[str] = None


@router.put("/settings")
def save_meal_settings(body: MealTimesBody, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    """식사 시간 저장 — ADMIN 전용. 식수 정산의 기준 시간이 된다."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "식사 시간 설정은 ADMIN만 가능합니다.")
    row = db.query(MealTimeSetting).first()
    if not row:
        row = MealTimeSetting()
        db.add(row)
    hhmm = re.compile(r"^\d{2}:\d{2}$")
    for k in MEAL_TIME_FIELDS:
        v = (getattr(body, k) or "").strip()
        setattr(row, k, v if hhmm.match(v) else None)
    row.updated_by = getattr(current_user, "name", None)
    db.commit()
    return ApiResponse(success=True, data=_meal_times(db))


@router.get("/week")
def get_week(date_: str = Query(..., alias="date"), db: Session = Depends(get_db),
             _: User = Depends(get_current_user)):
    """해당 날짜가 포함된 주의 식단 — 월요일 시작 기준."""
    if not _YMD.match(date_):
        raise HTTPException(400, "date는 YYYY-MM-DD 형식이어야 합니다.")
    d = date.fromisoformat(date_)
    monday = (d - timedelta(days=d.weekday())).isoformat()
    row = db.query(MealWeek).filter(MealWeek.start == monday).first()
    if not row:  # 시작일이 월요일이 아닌 주간표(공휴일 등)도 포용 — 날짜 포함 주 검색
        row = (db.query(MealWeek)
               .filter(MealWeek.start <= date_, MealWeek.end >= date_)
               .order_by(MealWeek.start.desc()).first())
    return ApiResponse(success=True, data=_view(row) if row else None)


@router.get("/month")
def get_month(month: str = Query(...), db: Session = Depends(get_db),
              _: User = Depends(get_current_user)):
    """월간 보기 — 그 달에 걸치는 주간표를 전부 합쳐 일자별로."""
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    first = f"{month}-01"
    last = f"{month}-31"
    rows = (db.query(MealWeek)
            .filter(MealWeek.end >= first, MealWeek.start <= last)
            .order_by(MealWeek.start).all())
    days: dict = {}
    for r in rows:
        for k, v in (r.days or {}).items():
            if k.startswith(month):
                days[k] = v
    notes = rows[-1].notes if rows and rows[-1].notes else []
    return ApiResponse(success=True, data={"month": month, "days": days, "notes": notes,
                                           "week_count": len(rows)})


@router.get("/weeks")
def list_weeks(limit: int = Query(12), db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    rows = (db.query(MealWeek).order_by(MealWeek.start.desc())
            .limit(max(1, min(limit, 60))).all())
    return ApiResponse(success=True, data=[{"start": r.start, "end": r.end,
                                            "updated_by": r.updated_by} for r in rows])
