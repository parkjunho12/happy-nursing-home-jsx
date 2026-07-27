"""근무표 API — 읽기·쓰기 모두 ADMIN·시설장 전용"""
from __future__ import annotations
import logging
import re
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.work_schedule import WorkSchedule, WorkScheduleVersion, WorkScheduleConfig
from app.models.eval import LtcStaffMember
from app.services.staff_notify import notify_all_staff
from app.models.staffing import HolidayCalendar
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()
_YM = re.compile(r"^\d{4}-\d{2}$")


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "근무표 접근 권한이 없습니다. (관리자·시설장)")
    return current_user


def _prev_ym(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:7])
    m -= 1
    if m == 0:
        m, y = 12, y - 1
    return f"{y}-{m:02d}"


def _inherit_rows(db: Session, ym: str, back: int = 6) -> tuple:
    """이번 달에 조 편성이 없으면 가장 가까운 이전 달 것을 물려준다.
    매달 조를 다시 짜는 건 낭비이고, 조 구성은 잘 바뀌지 않기 때문."""
    cur = ym
    for _ in range(back):
        cur = _prev_ym(cur)
        w = db.query(WorkSchedule).filter(WorkSchedule.year_month == cur).first()
        if w and w.rows:
            return w.rows, cur
    return [], None


def _view(w: Optional[WorkSchedule], ym: str, db: Optional[Session] = None) -> dict:
    return {
        "year_month": ym,
        "data": (w.data if w and w.data else {}),
        "rows": (w.rows if w and w.rows else []),
        # 저장된 값이 없으면 null — 프론트가 (토·일·공휴일 제외 일수)×8로 자동 계산한다.
        # 예전에는 여기서 "160"을 내려보내 자동 계산값을 덮어썼다.
        "base_hours": (w.base_hours if w else None) or None,
        "base_days": (w.base_days if w else None) or None,
        "as_of": (w.as_of if w else None),
        "team_offsets": (w.team_offsets if w and w.team_offsets else None),
        "updated_by": (w.updated_by if w else None),
        "updated_at": (w.updated_at.isoformat() if w and w.updated_at else None),
    }


KEEP_VERSIONS = 30      # 월별로 최근 30개까지만 보관


def _count_cells(data: Optional[Dict[str, Any]]) -> int:
    """입력된 근무 칸 수"""
    return sum(1 for row in (data or {}).values() if isinstance(row, dict)
               for v in row.values() if v)


def _diff_cells(a: Optional[Dict[str, Any]], b: Optional[Dict[str, Any]]) -> int:
    """두 근무표 사이에 값이 달라진 칸 수 (추가·삭제·변경 모두)"""
    a, b = a or {}, b or {}
    keys = set()
    for sid in set(a) | set(b):
        for day in set((a.get(sid) or {})) | set((b.get(sid) or {})):
            keys.add((sid, day))
    return sum(1 for sid, day in keys
               if (a.get(sid) or {}).get(day) != (b.get(sid) or {}).get(day))


def _version_view(v: WorkScheduleVersion, full: bool = False) -> dict:
    out = {
        "id": v.id, "year_month": v.year_month,
        "cells": v.cells or 0, "changed": v.changed or 0,
        "base_hours": v.base_hours, "base_days": v.base_days,
        "saved_by": v.saved_by, "saved_at": v.saved_at.isoformat() if v.saved_at else None,
    }
    if full:
        out.update({"data": v.data or {}, "rows": v.rows or [],
                    "as_of": v.as_of, "team_offsets": v.team_offsets})
    return out


class ScheduleBody(BaseModel):
    year_month: str
    data: Dict[str, Any] = {}
    rows: Optional[List[Dict[str, Any]]] = None
    base_hours: Optional[str] = None
    base_days: Optional[str] = None
    as_of: Optional[str] = None
    team_offsets: Optional[Dict[str, int]] = None


class ConfigBody(BaseModel):
    settle_start: Optional[str] = None
    rotation_anchor: Optional[str] = None


def _config_row(db: Session) -> WorkScheduleConfig:
    row = db.query(WorkScheduleConfig).first()
    if not row:
        row = WorkScheduleConfig(settle_start="2026-07", rotation_anchor="2026-08-01")
        db.add(row); db.commit(); db.refresh(row)
    return row


@router.post("/notify")
def notify_schedule(body: ScheduleBody, db: Session = Depends(get_db),
                    current_user: User = Depends(_manager)):
    """근무표 발표 알림 — 전 직원 푸시. 누르면 직원앱이 '내 근무표'를 연다."""
    if not _YM.match(body.year_month or ""):
        raise HTTPException(400, "year_month 형식은 YYYY-MM 이어야 합니다.")
    y, m = body.year_month.split("-")
    result = notify_all_staff(
        db,
        f"{int(m)}월 근무표가 나왔습니다",
        "내 근무표에서 이번 달 근무를 확인하세요.",
        data={"type": "my-schedule", "month": body.year_month},
        exclude_user_id=getattr(current_user, "id", None),
    )
    return ApiResponse(success=True, data=result)


@router.get("/mine")
def my_schedule(month: str = Query(...), db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """로그인한 직원 본인의 한 달 근무 — 관리자 권한 없이 전 직원이 본다.

    계정 관리에서 연동한 직원을 최우선으로, 미연동 계정은 이름 매칭으로 찾는다."""
    if not _YM.match(month or ""):
        raise HTTPException(400, "month 형식은 YYYY-MM 이어야 합니다.")
    from app.services.staff_link import resolve_staff_for_user
    staff = resolve_staff_for_user(db, current_user)

    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    codes = (w.data or {}).get(staff.id, {}) if w else {}
    team = None
    for r in (w.rows or []) if w else []:
        if r.get("staff_id") == staff.id:
            team = r.get("team")
            break
    return ApiResponse(success=True, data={
        "year_month": month, "staff_name": staff.name, "team": team,
        "codes": codes,
        # 개인별 한 줄 설명 — 저장 시 생성. "왜 이렇게 나왔어요?"에 대한 답
        "note": ((w.notes or {}).get(staff.id) if w else None),
        "updated_at": (w.updated_at.isoformat() if w and w.updated_at else None),
    })


@router.get("/config")
def get_config(db: Session = Depends(get_db), _: User = Depends(_manager)):
    """정산 시작월·회전 기준일 — 연도가 바뀌면 여기만 고치면 된다."""
    row = _config_row(db)
    return ApiResponse(success=True, data={
        "settle_start": row.settle_start or "2026-07",
        "rotation_anchor": row.rotation_anchor or "2026-08-01",
    })


@router.put("/config")
def save_config(body: ConfigBody, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    if body.settle_start and not re.match(r"^\d{4}-\d{2}$", body.settle_start):
        raise HTTPException(400, "정산 시작월은 YYYY-MM 형식이어야 합니다.")
    if body.rotation_anchor and not re.match(r"^\d{4}-\d{2}-\d{2}$", body.rotation_anchor):
        raise HTTPException(400, "회전 기준일은 YYYY-MM-DD 형식이어야 합니다.")
    row = _config_row(db)
    if body.settle_start is not None: row.settle_start = body.settle_start or None
    if body.rotation_anchor is not None: row.rotation_anchor = body.rotation_anchor or None
    row.updated_by = getattr(current_user, "name", None)
    db.commit(); db.refresh(row)
    return ApiResponse(success=True, data={
        "settle_start": row.settle_start, "rotation_anchor": row.rotation_anchor,
    })


@router.get("/holidays")
def month_holidays(month: str = Query(...), db: Session = Depends(get_db), _: User = Depends(_manager)):
    """해당 월의 공휴일 { 'YYYY-MM-DD': {name, kind} }.

    kind='paid' = 근로자의 날처럼 관공서 공휴일은 아니지만 유급휴일인 날.
    빨간 날과 색·계산을 다르게 다루기 위해 종류를 함께 내려준다."""
    if not _YM.match(month or ""):
        raise HTTPException(400, "month 형식은 YYYY-MM 이어야 합니다.")
    y = int(month[:4])

    # DB에 등록된 공휴일 (음력 명절·대체공휴일·임시공휴일)
    table: List[Dict[str, Any]] = []
    try:
        rows = db.query(HolidayCalendar).filter(HolidayCalendar.active == True).all()  # noqa: E712
        table = [{"date": r.date, "name": r.name, "kind": r.kind} for r in rows]
    except Exception as e:
        logger.warning("holiday_calendar 조회 실패: %s", e)

    # 라이브러리/규칙 기반 공휴일과 병합 (실패해도 DB 값은 살린다)
    try:
        from app.services import staffing as S
        hol = S.get_korean_holidays(y, None, table)
    except Exception as e:
        logger.warning("공휴일 계산 실패, DB 값만 사용: %s", e)
        hol = {r["date"]: (r.get("name") or "공휴일") for r in table}

    kinds = {r["date"]: (r.get("kind") or "public") for r in table}
    PAID = {"근로자의 날"}
    out = {}
    for d, n in (hol or {}).items():
        if not d.startswith(month):
            continue
        k = kinds.get(d) or "public"
        if n in PAID or k == "paid":
            k = "paid"
        out[d] = {"name": n, "kind": k}
    return ApiResponse(success=True, data=out)


@router.get("")
def get_schedule(month: str = Query(...), db: Session = Depends(get_db), _: User = Depends(_manager)):
    if not _YM.match(month or ""):
        raise HTTPException(400, "month 형식은 YYYY-MM 이어야 합니다.")
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == month).first()
    data = _view(w, month)
    # 이번 달 조 편성이 비어 있으면 이전 달 것을 이어받는다
    if not data["rows"]:
        rows, src = _inherit_rows(db, month)
        if rows:
            data["rows"] = rows
            data["rows_from"] = src        # 어느 달에서 가져왔는지 화면에 알려준다
    return ApiResponse(success=True, data=data)


class ExplainPerson(BaseModel):
    staff_id: str
    name: str
    team: Optional[str] = None
    hours: int = 0            # 총시간 (추가근무 포함)
    base: int = 0             # 월 기준시간
    d: int = 0                # 주간 근무 수
    n: int = 0                # 야간 근무 수
    annual: int = 0           # 연차(休)
    daehyu: int = 0           # 대휴
    comp: int = 0             # 초과휴
    extra: int = 0            # 추가근무 시간
    carry: Optional[int] = None   # 다음 달로 이월되는 미상환 시간


class ExplainBody(BaseModel):
    month: str
    people: List[ExplainPerson]


def _fallback_note(p: ExplainPerson) -> str:
    """AI 없이도 나오는 기본 한 줄 — 숫자는 어차피 여기 다 있다."""
    bits = []
    if p.n: bits.append(f"주간 {p.d}·야간 {p.n}")
    elif p.d: bits.append(f"주간 {p.d}일")
    if p.annual: bits.append(f"연차 {p.annual}일")
    if p.daehyu: bits.append(f"공휴일 근무 보상 대휴 {p.daehyu}일")
    if p.comp: bits.append(f"밀린 추가근무 보상 초과휴 {p.comp}일")
    if p.extra: bits.append(f"추가근무 {p.extra}시간")
    body = ", ".join(bits) if bits else "이번 달 근무"
    return f"{body} — 총 {p.hours}시간 (기준 {p.base}시간 충족)"


@router.post("/explain")
def explain_schedule(body: ExplainBody, db: Session = Depends(get_db),
                     current_user: User = Depends(_manager)):
    """저장된 근무표에 개인별 한 줄 설명을 붙인다.

    "왜 나는 이번 달 이렇게 나왔어요?"에 관리자가 일일이 답하지 않도록,
    정산 숫자를 사람 말로 풀어 직원 내 근무표에 보여준다.
    계산은 프론트 정산 엔진 결과를 그대로 받고, AI는 문장만 만든다(실패 시 템플릿)."""
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == body.month).first()
    if not w:
        raise HTTPException(404, "먼저 근무표를 저장해주세요.")

    notes = {p.staff_id: _fallback_note(p) for p in body.people}
    ai_used = False
    try:
        from app.core.config import settings
        if settings.OPENAI_API_KEY and body.people:
            import json
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            lines = "\n".join(
                f"- id={p.name}: 총 {p.hours}h/기준 {p.base}h, 주간 {p.d}, 야간 {p.n}, "
                f"연차 {p.annual}, 대휴 {p.daehyu}, 초과휴 {p.comp}, 추가근무 {p.extra}h"
                + (f", 이월 {p.carry}h" if p.carry else "")
                for p in body.people)
            r = client.chat.completions.create(
                model=settings.OPENAI_MODEL or "gpt-4o-mini",
                messages=[{"role": "user", "content": (
                    "요양원 근무표를 받은 50~60대 요양보호사 선생님께 보여줄 개인별 한 줄 설명을 만들어주세요.\n"
                    "규칙: 각자 60자 이내 존댓말 1문장. 숫자를 바꾸거나 새로 만들지 말 것. "
                    "대휴=공휴일 근무 보상, 초과휴=밀린 추가근무 보상이라는 취지가 드러나게. "
                    "쉬운 말로, 따뜻하지만 담백하게.\n"
                    f"{body.month} 근무 내역:\n{lines}\n\n"
                    '출력은 JSON 하나만: {"이름": "설명", ...}'
                )}],
                max_tokens=1500, temperature=0.4, timeout=30,
            )
            txt = (r.choices[0].message.content or "").strip()
            txt = txt[txt.find("{"): txt.rfind("}") + 1]
            by_name = json.loads(txt)
            name_to_id = {p.name: p.staff_id for p in body.people}
            for nm, note in by_name.items():
                sid = name_to_id.get(nm)
                if sid and isinstance(note, str) and 5 <= len(note) <= 120:
                    notes[sid] = note.strip()
            ai_used = True
    except Exception as e:
        logger.warning("근무표 설명 AI 생성 실패 — 템플릿 사용: %s", e)

    w.notes = notes                      # JSON 재할당으로 변경 감지
    db.commit()
    return ApiResponse(success=True, data={"count": len(notes), "ai": ai_used})


@router.put("")
def save_schedule(body: ScheduleBody, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    if not _YM.match(body.year_month or ""):
        raise HTTPException(400, "year_month 형식은 YYYY-MM 이어야 합니다.")
    w = db.query(WorkSchedule).filter(WorkSchedule.year_month == body.year_month).first()
    if not w:
        w = WorkSchedule(year_month=body.year_month)
        db.add(w)
    w.data = body.data or {}
    if body.rows is not None: w.rows = body.rows
    if body.base_hours is not None: w.base_hours = body.base_hours
    if body.base_days is not None: w.base_days = body.base_days
    if body.as_of is not None: w.as_of = body.as_of
    if body.team_offsets is not None: w.team_offsets = body.team_offsets
    w.updated_by = getattr(current_user, "name", None)

    # 저장 시점 스냅샷을 남긴다 — 편성이 꼬였을 때 되돌리기 위한 이력
    try:
        prev = (db.query(WorkScheduleVersion)
                .filter(WorkScheduleVersion.year_month == body.year_month)
                .order_by(WorkScheduleVersion.saved_at.desc()).first())
        changed = _diff_cells(prev.data if prev else {}, w.data)
        # 근무 칸이 하나도 안 바뀌었으면 이력을 새로 만들지 않는다 (기준값만 고친 경우 등)
        if prev is None or changed > 0:
            db.add(WorkScheduleVersion(
                year_month=body.year_month, data=w.data, rows=w.rows,
                base_hours=w.base_hours, base_days=w.base_days,
                as_of=w.as_of, team_offsets=w.team_offsets,
                cells=_count_cells(w.data), changed=changed,
                saved_by=getattr(current_user, "name", None),
            ))
            db.flush()
            # 오래된 이력 정리
            olds = (db.query(WorkScheduleVersion)
                    .filter(WorkScheduleVersion.year_month == body.year_month)
                    .order_by(WorkScheduleVersion.saved_at.desc())
                    .offset(KEEP_VERSIONS).all())
            for o in olds:
                db.delete(o)
    except Exception as e:
        logger.warning("근무표 이력 기록 실패(저장은 계속): %s", e)

    db.commit(); db.refresh(w)
    return ApiResponse(success=True, data=_view(w, body.year_month))


@router.get("/versions")
def list_versions(month: str = Query(...), db: Session = Depends(get_db), _: User = Depends(_manager)):
    """해당 월의 저장 이력 (최신순)"""
    if not _YM.match(month or ""):
        raise HTTPException(400, "month 형식은 YYYY-MM 이어야 합니다.")
    rows = (db.query(WorkScheduleVersion)
            .filter(WorkScheduleVersion.year_month == month)
            .order_by(WorkScheduleVersion.saved_at.desc()).limit(KEEP_VERSIONS).all())
    return ApiResponse(success=True, data=[_version_view(v) for v in rows])


@router.get("/versions/{vid}")
def get_version(vid: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    """저장 이력 하나를 통째로 — 화면에서 불러오기용"""
    v = db.query(WorkScheduleVersion).filter(WorkScheduleVersion.id == vid).first()
    if not v:
        raise HTTPException(404, "저장 이력을 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_version_view(v, full=True))
