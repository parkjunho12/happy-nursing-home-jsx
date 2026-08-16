"""프로그램 일정·분류 API.

엑셀 업로드 → 파싱 저장 → 어드민 미리보기 → 게시(보호자앱 노출).
권한: ADMIN · 시설장 · 사회복지사
"""
from __future__ import annotations
import re
from typing import Optional
from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, Query, UploadFile)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.program import ProgramMonth, ProgramGroupSet, ProgramChangeLog, ProgramSetting, ProgramGroupLog
from app.schemas.response import ApiResponse

router = APIRouter()
family_router = APIRouter()


def _resync_broadcast(bg: Optional[BackgroundTasks]) -> None:
    """프로그램표가 바뀌면 자동 안내방송 예약도 다시 맞춘다.

    응답을 붙잡지 않도록 뒤에서 돌린다 — 음성 생성이 끼면 몇 초씩 걸린다.
    자동방송이 꺼져 있으면 그 안에서 아무것도 하지 않는다.
    """
    if bg is None:
        return
    from app.core.database import SessionLocal
    from app.services.program_broadcast import sync_quiet
    bg.add_task(sync_quiet, SessionLocal)


def _guardian_dep():
    from app.api.v1.endpoints.albums import get_guardian_id  # 순환 임포트 방지 지연 로드
    return get_guardian_id
_YM = re.compile(r"^\d{4}-\d{2}$")


@family_router.get("/programs")
def family_program(month: str = Query(...), db: Session = Depends(get_db),
                   gid: str = Depends(_guardian_dep())):
    """보호자앱 프로그램표 — 게시된 달만 보인다."""
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    row = (db.query(ProgramMonth)
           .filter(ProgramMonth.month == month, ProgramMonth.published == True).first())  # noqa: E712
    # 이동 편의: 게시된 달 목록도 함께
    published = [m for (m,) in db.query(ProgramMonth.month)
                 .filter(ProgramMonth.published == True).order_by(ProgramMonth.month).all()]  # noqa: E712
    return ApiResponse(success=True, data={
        "month": month, "published_months": published,
        "days": (row.days or {}) if row else None,
        # 내부 운영 규칙(notes)은 보호자에게 노출하지 않는다 — 보호자 안내 메모만
        "notes": ([ln for ln in (row.public_memo or "").split("\n") if ln.strip()]) if row else [],
    })


def _editor(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos not in ("시설장", "사회복지사", "대표", "이사"):
        raise HTTPException(403, "프로그램 관리 권한이 없습니다.")
    return current_user


def _summ(entries) -> str:
    return " / ".join(f"{e.get('slot', '')} {('[' + e['group'] + '] ') if e.get('group') else ''}{e.get('title', '')}".strip()
                      for e in (entries or []))[:280]


def _log(db: Session, month: str, action: str, who, day=None, before=None, after=None, summary=None):
    db.add(ProgramChangeLog(month=month, day=day, action=action,
                            before=before, after=after, summary=summary,
                            changed_by=getattr(who, "name", None)))


@router.post("/peek-schedule")
async def peek_schedule(file: UploadFile = File(...), _: User = Depends(_editor)):
    """엑셀 안의 월 시트 목록만 미리 확인 — 어느 달을 가져올지 고르게."""
    data = await file.read()
    from app.services.program_parser import list_schedule_months
    try:
        months = list_schedule_months(data)
    except Exception as e:
        raise HTTPException(400, f"엑셀을 읽지 못했습니다: {e}")
    if not months:
        raise HTTPException(400, "월 시트(예: '26.7월')를 찾지 못했습니다.")
    return ApiResponse(success=True, data={"months": months})


@router.post("/upload-schedule")
async def upload_schedule(bg: BackgroundTasks, file: UploadFile = File(...),
                          month: Optional[str] = Form(None),
                          preview: bool = Form(False),
                          db: Session = Depends(get_db),
                          current_user: User = Depends(_editor)):
    """일정표 엑셀 업로드 — preview=true면 저장 없이 파싱 결과만 돌려준다(「저장」 눌러야 반영)."""
    data = await file.read()
    from app.services.program_parser import parse_schedule_xlsx
    try:
        parsed = parse_schedule_xlsx(data, month=month)
    except Exception as e:
        raise HTTPException(400, f"일정표 파싱 실패: {e}")
    # 인지·여가·신체 기본 시간이 설정돼 있으면 시간 없는 항목에 자동으로 채운다
    setting = db.query(ProgramSetting).first()
    defaults = {t["category"]: t["time"] for t in _norm_times(setting.times if setting else None) if t["category"]}
    if defaults:
        for entries in parsed["days"].values():
            for e in entries:
                if e.get("time"):
                    continue
                cat = next((c for c in TIME_CATS if (e.get("group") or "").startswith(c)), None)
                if cat and cat in defaults:
                    e["time"] = defaults[cat]
    if preview:   # 화면 미리보기용 — DB에 아무것도 쓰지 않는다
        return ApiResponse(success=True, data={
            "month": parsed["month"], "sheet": parsed["sheet"],
            "day_count": len(parsed["days"]), "preview": True,
            "days": parsed["days"], "notes": parsed.get("notes") or [],
        })
    row = db.query(ProgramMonth).filter(ProgramMonth.month == parsed["month"]).first()
    if not row:
        row = ProgramMonth(month=parsed["month"])
        db.add(row)
    _log(db, parsed["month"], "업로드", current_user,
         summary=f"엑셀 업로드로 {len(parsed['days'])}일치 교체 (시트 {parsed['sheet']})")
    row.days = parsed["days"]
    if parsed.get("notes"):
        row.notes = parsed["notes"]
    row.updated_by = getattr(current_user, "name", None)
    db.commit()
    _resync_broadcast(bg)
    return ApiResponse(success=True, data={
        "month": parsed["month"], "sheet": parsed["sheet"],
        "day_count": len(parsed["days"]), "published": bool(row.published),
    })


@router.get("/schedule")
def get_schedule(month: str = Query(...), db: Session = Depends(get_db),
                 _: User = Depends(_editor)):
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    row = db.query(ProgramMonth).filter(ProgramMonth.month == month).first()
    return ApiResponse(success=True, data=None if not row else {
        "month": row.month, "days": row.days or {}, "published": bool(row.published),
        "notes": row.notes or [],
        "public_memo": row.public_memo or "",
        "updated_by": row.updated_by,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    })


class PublishBody(BaseModel):
    published: bool


@router.patch("/schedule/{month}")
def publish_schedule(month: str, body: PublishBody, db: Session = Depends(get_db),
                     current_user: User = Depends(_editor)):
    row = db.query(ProgramMonth).filter(ProgramMonth.month == month).first()
    if not row:
        raise HTTPException(404, "먼저 일정표를 업로드해주세요.")
    row.published = body.published
    row.updated_by = getattr(current_user, "name", None)
    _log(db, month, "게시" if body.published else "게시내림", current_user)
    db.commit()
    return ApiResponse(success=True, data={"month": month, "published": bool(row.published)})


class DayBody(BaseModel):
    entries: list   # [{slot:'오전'|'오후', group:str|null, title:str}]


@router.put("/schedule/{month}/day/{day}")
def edit_day(month: str, day: str, body: DayBody, bg: BackgroundTasks,
             db: Session = Depends(get_db),
             current_user: User = Depends(_editor)):
    """하루치 프로그램 수정 — 전후를 이력으로 남긴다."""
    row = db.query(ProgramMonth).filter(ProgramMonth.month == month).first()
    if not row:
        raise HTTPException(404, "먼저 일정표를 업로드해주세요.")
    d = str(int(day))
    entries = []
    for e in (body.entries or []):
        slot = e.get("slot") if e.get("slot") in ("오전", "오후") else "오후"
        title = (e.get("title") or "").strip()
        group = (e.get("group") or "").strip() or None
        if title or group:
            time = (e.get("time") or "").strip() or None
            kind = (e.get("kind") or "").strip() or None
            entries.append({"slot": slot, "group": group, "title": title,
                            **({"time": time} if time else {}),
                            **({"kind": kind} if kind else {})})
    days = dict(row.days or {})
    before = days.get(d) or []
    if entries:
        days[d] = entries
    else:
        days.pop(d, None)
    row.days = days                       # JSON 재할당으로 변경 감지
    row.updated_by = getattr(current_user, "name", None)
    _log(db, month, "수정", current_user, day=d, before=before, after=entries,
         summary=f"{int(d)}일: {_summ(before) or '(없음)'} → {_summ(entries) or '(없음)'}")
    db.commit()
    _resync_broadcast(bg)
    return ApiResponse(success=True, data={"month": month, "day": d, "entries": entries})


class NotesBody(BaseModel):
    notes: list


class PublicMemoBody(BaseModel):
    memo: str = ""


@router.patch("/schedule/{month}/notes")
def edit_notes(month: str, body: NotesBody, db: Session = Depends(get_db),
               current_user: User = Depends(_editor)):
    row = db.query(ProgramMonth).filter(ProgramMonth.month == month).first()
    if not row:
        raise HTTPException(404, "먼저 일정표를 업로드해주세요.")
    row.notes = [str(n).strip() for n in (body.notes or []) if str(n).strip()]
    row.updated_by = getattr(current_user, "name", None)
    _log(db, month, "수정", current_user, summary="운영 규칙 안내 수정")
    db.commit()
    return ApiResponse(success=True, data={"notes": row.notes})


@router.patch("/schedule/{month}/public-memo")
def edit_public_memo(month: str, body: PublicMemoBody, db: Session = Depends(get_db),
                     user: User = Depends(_editor)):
    """보호자 안내 메모 — 보호자앱·공식 웹에 노출되는 건 이것뿐."""
    row = db.query(ProgramMonth).filter(ProgramMonth.month == month).first()
    if not row:
        raise HTTPException(404, "해당 월 일정표가 없습니다.")
    row.public_memo = (body.memo or "").strip()[:2000] or None
    row.updated_by = getattr(user, "name", None)
    db.commit()
    return ApiResponse(success=True, data={"public_memo": row.public_memo or ""})


class TimesBody(BaseModel):
    times: list   # [{time:'10:00~10:40', category:'인지'|'여가'|'신체'|null}] — 문자열도 허용(구버전)

TIME_CATS = ("인지", "여가", "신체")


def _norm_times(raw) -> list:
    """문자열/객체 혼용 입력을 [{time, category}]로 정규화 — 시간 기준 중복 제거."""
    out, seen = [], set()
    for t in (raw or []):
        if isinstance(t, dict):
            tv = str(t.get("time") or "").strip()
            cat = str(t.get("category") or "").strip() or None
        else:
            tv, cat = str(t).strip(), None
        if cat not in TIME_CATS:
            cat = None
        if tv and (tv, cat) not in seen:
            out.append({"time": tv, "category": cat}); seen.add((tv, cat))
    return out


@router.get("/times")
def get_times(db: Session = Depends(get_db), _: User = Depends(_editor)):
    row = db.query(ProgramSetting).first()
    return ApiResponse(success=True, data={"times": _norm_times(row.times if row else None)})


@router.put("/times")
def save_times(body: TimesBody, db: Session = Depends(get_db),
               current_user: User = Depends(_editor)):
    """진행 시간 목록 저장 — 카테고리(인지·여가·신체)를 지정하면 그 그룹의 기본 시간이 된다."""
    times = _norm_times(body.times)
    row = db.query(ProgramSetting).first()
    if not row:
        row = ProgramSetting()
        db.add(row)
    row.times = times
    row.updated_by = getattr(current_user, "name", None)
    db.commit()
    return ApiResponse(success=True, data={"times": times})


@router.post("/share-image")
async def upload_share_image(file: UploadFile = File(...),
                             _: User = Depends(_editor)):
    """카톡 공유용 명단 이미지 저장 — R2(운영)면 공개 https URL이 돌아온다."""
    data = await file.read()
    from app.services.storage import save_upload
    url = save_upload(data, "programs", file.filename or "roster.png", file.content_type or "image/png")
    return ApiResponse(success=True, data={"url": url})


@router.get("/group-logs")
def group_logs(limit: int = Query(80), db: Session = Depends(get_db), _: User = Depends(_editor)):
    """수급자 그룹·종교 변경 이력 — 누가 언제 어느 그룹으로 옮겼는지."""
    rows = (db.query(ProgramGroupLog).order_by(ProgramGroupLog.created_at.desc())
            .limit(max(1, min(limit, 300))).all())
    return ApiResponse(success=True, data=[{
        "id": l.id, "resident_name": l.resident_name, "field": l.field,
        "before": l.before, "after": l.after, "changed_by": l.changed_by,
        "at": l.created_at.isoformat() if l.created_at else None,
    } for l in rows])


@router.get("/logs")
def program_logs(month: Optional[str] = Query(None), limit: int = Query(60),
                 db: Session = Depends(get_db), _: User = Depends(_editor)):
    q = db.query(ProgramChangeLog)
    if month:
        q = q.filter(ProgramChangeLog.month == month)
    rows = q.order_by(ProgramChangeLog.created_at.desc()).limit(max(1, min(limit, 200))).all()
    return ApiResponse(success=True, data=[{
        "id": l.id, "month": l.month, "day": l.day, "action": l.action,
        "summary": l.summary, "changed_by": l.changed_by,
        "at": l.created_at.isoformat() if l.created_at else None,
    } for l in rows])


@router.post("/upload-groups")
async def upload_groups(file: UploadFile = File(...), db: Session = Depends(get_db),
                        current_user: User = Depends(_editor)):
    """분류표 엑셀 업로드 — 가장 최근 날짜 시트의 그룹 명단 저장(내부용)."""
    data = await file.read()
    from app.services.program_parser import parse_groups_xlsx
    try:
        parsed = parse_groups_xlsx(data)
    except Exception as e:
        raise HTTPException(400, f"분류표 파싱 실패: {e}")
    row = db.query(ProgramGroupSet).filter(ProgramGroupSet.based_on == parsed["based_on"]).first()
    if not row:
        row = ProgramGroupSet(based_on=parsed["based_on"])
        db.add(row)
    row.data = {"groups": parsed["groups"], "religion": parsed["religion"]}
    row.updated_by = getattr(current_user, "name", None)
    db.commit()
    return ApiResponse(success=True, data={
        "based_on": parsed["based_on"], "sheet": parsed["sheet"],
        "group_count": len(parsed["groups"]),
    })


class GroupsBody(BaseModel):
    groups: list      # [{category, grade, members_by_floor:{'2층':[이름...]}}]
    religion: list    # [{name, members:[이름...]}]


@router.put("/groups")
def save_groups(body: GroupsBody, db: Session = Depends(get_db),
                current_user: User = Depends(_editor)):
    """분류표 직접 수정 — 최신 스냅샷을 덮어쓴다(층별 명단에서 전체 명단 재계산)."""
    row = db.query(ProgramGroupSet).order_by(ProgramGroupSet.based_on.desc()).first()
    if not row:
        raise HTTPException(404, "먼저 분류표를 업로드해주세요.")
    groups = []
    for g in (body.groups or []):
        cat = str(g.get("category") or "").strip()
        grade = str(g.get("grade") or "").strip()
        if not cat or not grade:
            continue
        by_floor = {}
        for fl, names in (g.get("members_by_floor") or {}).items():
            clean = [str(n).strip() for n in (names or []) if str(n).strip()]
            if clean:
                by_floor[str(fl).strip()] = clean
        members = [n for fl in sorted(by_floor) for n in by_floor[fl]]
        if not members and g.get("members"):   # 층 정보 없이 온 옛 데이터 호환
            members = [str(n).strip() for n in g["members"] if str(n).strip()]
        groups.append({"category": cat, "grade": grade,
                       "members": members, "members_by_floor": by_floor})
    religion = []
    for r in (body.religion or []):
        name = str(r.get("name") or "").strip()
        clean = [str(n).strip() for n in (r.get("members") or []) if str(n).strip()]
        if name:
            religion.append({"name": name, "members": clean})
    row.data = {"groups": groups, "religion": religion}
    row.updated_by = getattr(current_user, "name", None)
    db.commit()
    return ApiResponse(success=True, data={"based_on": row.based_on, "group_count": len(groups)})


@router.get("/groups")
def latest_groups(db: Session = Depends(get_db), _: User = Depends(_editor)):
    row = (db.query(ProgramGroupSet)
           .order_by(ProgramGroupSet.based_on.desc()).first())
    return ApiResponse(success=True, data=None if not row else {
        "based_on": row.based_on, **(row.data or {}), "updated_by": row.updated_by,
    })
