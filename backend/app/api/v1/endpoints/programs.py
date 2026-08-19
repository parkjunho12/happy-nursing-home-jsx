"""프로그램 일정·분류 API.

엑셀 업로드 → 파싱 저장 → 어드민 미리보기 → 게시(보호자앱 노출).
권한: ADMIN · 시설장 · 사회복지사
"""
from __future__ import annotations
import io
import logging
import os
import re
from datetime import datetime, timezone as _tz_p, timedelta as _td_p
from typing import Optional
from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, Query, UploadFile)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.program import (ProgramMonth, ProgramGroupSet, ProgramChangeLog,
                                ProgramSetting, ProgramGroupLog, ProgramPhoto)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
_KST_P = _tz_p(_td_p(hours=9))
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


# ══════════════════════════════════════════════════════════════
# 프로그램 사진 — 그날 그 프로그램을 찍은 사진·영상
#
# 내부용이다. 보호자앱(family_router)은 이 표를 보지 않는다 —
# 일정표를 게시해도 사진은 함께 나가지 않는다.
# 보호자에게 보여드릴 사진은 보호자 앨범(albums)이 따로 있다.
#
# 파일은 R2 에 둔다. 서버 디스크(50GB)에 사진이 쌓이면 방송 음원·업로드와
# 같이 차올라 어느 날 갑자기 저장이 실패한다.
# ══════════════════════════════════════════════════════════════
MAX_PHOTO_MB = 25
MAX_PER_UPLOAD = 20


def _exif_taken(data: bytes) -> Optional[datetime]:
    """사진에 박힌 찍은 시각(EXIF DateTimeOriginal).

    스마트폰·카메라 사진에는 거의 항상 들어 있다. 이게 있어야 '언제 찍은 사진인지'
    를 사람이 일일이 고르지 않아도 된다. 없거나 이상하면 None 을 준다.
    """
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        exif = img.getexif()
        if not exif:
            return None
        # 36867 DateTimeOriginal, 36868 DateTimeDigitized, 306 DateTime
        raw = None
        for tag in (36867, 36868, 306):
            v = exif.get(tag)
            if not v and hasattr(exif, "get_ifd"):
                v = (exif.get_ifd(0x8769) or {}).get(tag)
            if v:
                raw = str(v).strip()
                break
        if not raw:
            return None
        dt = datetime.strptime(raw[:19], "%Y:%m:%d %H:%M:%S")
        return dt.replace(tzinfo=_KST_P)
    except Exception:
        return None


def _pick_day(month: str, taken: Optional[datetime], fallback: Optional[datetime]) -> tuple:
    """그 사진이 이 달 며칠 것인지. (day, taken_at)

    찍은 달이 관리 중인 달과 다르면 날짜를 믿지 않는다 — 지난달 사진이
    이번 달 3일에 끼면 더 헷갈린다. 그런 것은 1일에 모아두고 사람이 옮긴다.
    """
    for t in (taken, fallback):
        if t and t.strftime("%Y-%m") == month:
            return t.day, t
    return 1, (taken or fallback)


def _photo_view(p: ProgramPhoto) -> dict:
    return {
        "id": p.id, "month": p.month, "day": p.day, "title": p.title, "grp": p.grp,
        "file_url": p.file_url, "thumbnail_url": p.thumbnail_url,
        "media_type": p.media_type, "file_size": p.file_size, "caption": p.caption,
        "taken_at": p.taken_at.isoformat() if p.taken_at else None,
        "uploaded_by": p.uploaded_by,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/photos")
def list_photos(month: str = Query(...), db: Session = Depends(get_db),
                _: User = Depends(_editor)):
    """그 달 사진 전부 — 화면에서 날짜·프로그램별로 묶는다."""
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    rows = (db.query(ProgramPhoto)
              .filter(ProgramPhoto.month == month)
              .order_by(ProgramPhoto.day, ProgramPhoto.created_at).all())
    return ApiResponse(success=True, data=[_photo_view(p) for p in rows])


@router.post("/photos")
async def upload_photos(
    month: str = Form(...),
    day: Optional[int] = Form(None),
    title: Optional[str] = Form(None),
    grp: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    # 브라우저가 아는 파일 수정시각(밀리초). EXIF 가 없는 사진의 보조 수단이다.
    taken_ms: Optional[str] = Form(None),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_editor),
):
    """사진을 올린다.

    프로그램(title)을 안 정해도 된다 — 먼저 날짜별로 담아두고 나중에 붙인다.
    날짜는 사진에 박힌 찍은 시각(EXIF)으로 정한다. 스무 장을 한 번에 올리고
    사람이 일일이 날짜를 고르는 것은 현실적이지 않다.
    """
    from app.services.r2_storage import r2
    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    if day is not None and not (1 <= int(day) <= 31):
        raise HTTPException(400, "일자가 올바르지 않습니다.")
    if not r2.is_configured():
        raise HTTPException(503, "사진 저장소(R2)가 설정되지 않았습니다. 관리자에게 알려주세요.")
    files = [f for f in (files or []) if f and f.filename]
    if not files:
        raise HTTPException(400, "올릴 파일이 없습니다.")
    if len(files) > MAX_PER_UPLOAD:
        raise HTTPException(400, f"한 번에 {MAX_PER_UPLOAD}장까지 올릴 수 있습니다.")

    # 파일 순서대로 대응하는 수정시각 목록 (없으면 빈 칸)
    ms_list = [x.strip() for x in (taken_ms or "").split(",")]

    out, failed = [], []
    for idx, f in enumerate(files):
        try:
            head = await f.read(MAX_PHOTO_MB * 1024 * 1024 + 1)
            if len(head) > MAX_PHOTO_MB * 1024 * 1024:
                failed.append(f"{f.filename} (용량 초과 · 최대 {MAX_PHOTO_MB}MB)")
                continue
            taken = _exif_taken(head)
            mtime = None
            if idx < len(ms_list) and ms_list[idx].isdigit():
                mtime = datetime.fromtimestamp(int(ms_list[idx]) / 1000, _KST_P)
            await f.seek(0)
            url, thumb, kind, size = r2.upload_file(f, month, prefix="programs")
        except HTTPException as e:
            failed.append(f"{f.filename} ({e.detail})")
            continue
        except Exception as e:
            logger.warning("프로그램 사진 업로드 실패 %s: %s", f.filename, e)
            failed.append(f"{f.filename} (업로드 실패)")
            continue
        # 사람이 날짜를 골랐으면 그것이 우선이다
        auto_day, taken_at = _pick_day(month, taken, mtime)
        row = ProgramPhoto(
            month=month, day=int(day) if day else auto_day,
            title=(title or "").strip()[:200] or None,
            grp=(grp or "").strip()[:50] or None,
            file_url=url, thumbnail_url=thumb or None, media_type=kind, file_size=size,
            caption=(caption or "").strip()[:300] or None,
            taken_at=taken_at,
            uploaded_by=getattr(current_user, "name", None))
        db.add(row)
        out.append(row)
    db.commit()
    for r in out:
        db.refresh(r)
    _log(db, month, "수정", current_user,
         day=str(int(day)) if day else None,
         summary=f"사진 {len(out)}장 등록" + (f" — 「{title.strip()}」" if title else ""))
    db.commit()
    return ApiResponse(success=True,
                       data={"uploaded": [_photo_view(p) for p in out], "failed": failed},
                       message=f"{len(out)}장을 올렸습니다." +
                               (f" ({len(failed)}장 실패)" if failed else ""))


class PhotoPatch(BaseModel):
    day: Optional[int] = None
    title: Optional[str] = None
    grp: Optional[str] = None
    caption: Optional[str] = None


@router.patch("/photos/{pid}")
def update_photo(pid: str, body: PhotoPatch, db: Session = Depends(get_db),
                 current_user: User = Depends(_editor)):
    """날짜를 옮기거나 어느 프로그램인지 붙인다."""
    p = db.query(ProgramPhoto).filter(ProgramPhoto.id == pid).first()
    if not p:
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    if body.day is not None:
        if not (1 <= int(body.day) <= 31):
            raise HTTPException(400, "일자가 올바르지 않습니다.")
        p.day = int(body.day)
    if body.title is not None:
        p.title = body.title.strip()[:200] or None
    if body.grp is not None:
        p.grp = body.grp.strip()[:50] or None
    if body.caption is not None:
        p.caption = body.caption.strip()[:300] or None
    db.commit(); db.refresh(p)
    return ApiResponse(success=True, data=_photo_view(p))


@router.get("/photos/download")
def download_photos(month: str = Query(...), day: Optional[int] = Query(None),
                    db: Session = Depends(get_db), _: User = Depends(_editor)):
    """그날 사진을 하나로 묶어 내려준다.

    한 장씩 눌러 받으면 스무 번이다. 서버가 R2 에서 읽어 zip 으로 묶는다 —
    브라우저에서 직접 받으면 다른 도메인이라 막힌다.

    파일 이름은 '14일_1032_색칠공부_1.jpg' 로 — 폴더에 풀었을 때 시간순으로
    정렬되고 어느 프로그램인지 보인다.
    """
    import re as _re
    import zipfile
    from tempfile import SpooledTemporaryFile
    from fastapi.responses import StreamingResponse
    from app.services.r2_storage import r2

    if not _YM.match(month):
        raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    q = db.query(ProgramPhoto).filter(ProgramPhoto.month == month)
    if day is not None:
        q = q.filter(ProgramPhoto.day == int(day))
    rows = q.order_by(ProgramPhoto.day, ProgramPhoto.taken_at,
                      ProgramPhoto.created_at).all()
    if not rows:
        raise HTTPException(404, "받을 사진이 없습니다.")

    def safe(v: str) -> str:
        return _re.sub(r"[^0-9A-Za-z가-힣_\-]+", "", (v or "")).strip()[:40]

    # 20장 × 25MB 를 통째로 메모리에 들면 서버가 휘청인다.
    # 일정 크기를 넘으면 디스크로 흘리는 임시 파일에 담는다.
    tmp = SpooledTemporaryFile(max_size=32 * 1024 * 1024)
    missing = 0
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:   # 사진은 이미 압축돼 있다
        for i, p in enumerate(rows, 1):
            data = r2.read_bytes(p.file_url)
            if data is None:
                missing += 1
                continue
            ext = os.path.splitext((p.file_url or "").split("?")[0])[1] or ".jpg"
            hm = p.taken_at.strftime("%H%M") if p.taken_at else "----"
            name = f"{p.day}일_{hm}_{safe(p.title) or '미지정'}_{i}{ext}"
            z.writestr(name, data)
    if missing == len(rows):
        raise HTTPException(502, "사진을 가져오지 못했습니다. 저장소를 확인해주세요.")
    tmp.seek(0)

    label = f"{month}" + (f"-{int(day):02d}" if day is not None else "")
    fname = f"{label}_프로그램사진.zip"
    from urllib.parse import quote
    return StreamingResponse(
        tmp, media_type="application/zip",
        headers={
            # 한글 파일명은 filename* 로 보내야 브라우저가 제대로 받는다
            "Content-Disposition": f"attachment; filename=photos.zip; filename*=UTF-8''{quote(fname)}",
            "X-Photo-Count": str(len(rows) - missing),
        })


class PhotoIds(BaseModel):
    ids: list[str]


@router.post("/photos/delete")
def delete_photos(body: PhotoIds, db: Session = Depends(get_db),
                  current_user: User = Depends(_editor)):
    """여러 장을 한 번에 지운다.

    한 장씩 지우면 스무 장을 정리하는 데 스무 번을 눌러야 한다.
    한 장이 저장소에서 안 지워져도 나머지는 계속 지운다 — 목록에 유령이 남는
    것보다 낫다.
    """
    from app.services.r2_storage import r2
    ids = [x for x in (body.ids or []) if x][:200]
    if not ids:
        raise HTTPException(400, "지울 사진을 골라주세요.")
    rows = db.query(ProgramPhoto).filter(ProgramPhoto.id.in_(ids)).all()
    if not rows:
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    month = rows[0].month
    for p in rows:
        try:
            r2.delete_file(p.file_url, p.thumbnail_url)
        except Exception as e:
            logger.warning("R2 삭제 실패(기록은 삭제): %s", e)
        db.delete(p)
    _log(db, month, "수정", current_user, summary=f"사진 {len(rows)}장 삭제")
    db.commit()
    return ApiResponse(success=True, data={"deleted": len(rows)},
                       message=f"{len(rows)}장을 지웠습니다.")


@router.delete("/photos/{pid}")
def delete_photo(pid: str, db: Session = Depends(get_db), current_user: User = Depends(_editor)):
    from app.services.r2_storage import r2
    p = db.query(ProgramPhoto).filter(ProgramPhoto.id == pid).first()
    if not p:
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    try:
        r2.delete_file(p.file_url, p.thumbnail_url)
    except Exception as e:                        # 저장소에서 못 지워도 목록에서는 내린다
        logger.warning("R2 삭제 실패(기록은 삭제): %s", e)
    month, day, title = p.month, p.day, p.title
    db.delete(p)
    _log(db, month, "수정", current_user, day=str(day),
         summary=f"{day}일 「{title}」 사진 1장 삭제")
    db.commit()
    return ApiResponse(success=True, data={"deleted": pid})
