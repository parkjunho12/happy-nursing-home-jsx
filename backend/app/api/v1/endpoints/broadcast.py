"""안내방송 — 관리자 API.

권한: ADMIN · 시설장. 방송은 건물 전체에 나가는 행위라 아무나 걸면 안 된다.

여기서 하는 일은 '예약을 만들고 보는 것'까지다. 실제 재생은 요양원 안의
Broadcast Agent(PC)가 한다. 서버는 소리를 내지 않는다.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.broadcast import (
    BroadcastSchedule, BroadcastMedia, BroadcastDevice, BroadcastRun,
    BroadcastLog, BroadcastCommand,
    BROADCAST_TYPES, TYPE_TTS, TYPE_AUDIO, TYPE_VIDEO,
    ST_DRAFT, ST_READY, ST_FAILED,
    RUN_PENDING, RUN_PLAYING, RUN_SUCCESS, RUN_FAILED, RUN_SKIPPED,
    ZONE_ALL, KNOWN_ZONES, now_kst,
)
from app.schemas.response import ApiResponse
from app.services import broadcast_media as media_svc
from app.services.broadcast_schedule import (
    KST, occurrences, next_occurrence, normalize_rule, describe_rule, to_kst,
)
from app.services.tts import get_provider, available_providers, TTSError

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────────────────────
# 권한
# ──────────────────────────────────────────────────────────────
# 방송을 걸 수 있는 사람. 건물 전체에 소리가 나가는 일이라 넓히지 않는다.
# 화면 가드(App.tsx BroadcastRoute)·사이드바(navConfig)와 이 목록이 같아야 한다.
BROADCAST_POSITIONS = ("시설장", "사회복지사")


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos not in BROADCAST_POSITIONS:
        raise HTTPException(403, "방송 권한이 없습니다. (관리자·시설장·사회복지사)")
    return current_user


def _audit(db: Session, *, event: str, user: User, schedule_id: str = None,
           title: str = None, device_id: str = None, status: str = None,
           error: str = None) -> None:
    db.add(BroadcastLog(event=event, schedule_id=schedule_id, title=title,
                        device_id=device_id, status=status, error_message=error,
                        actor=getattr(user, "name", None)))


# ──────────────────────────────────────────────────────────────
# 표현
# ──────────────────────────────────────────────────────────────
def _iso(dt) -> Optional[str]:
    d = to_kst(dt)
    return d.isoformat() if d else None


def _sched_view(s: BroadcastSchedule, *, nxt: Optional[datetime] = None) -> dict:
    return {
        "id": s.id, "title": s.title, "type": s.type, "text": s.text,
        "media_id": s.media_id, "media_url": s.media_url,
        "scheduled_at": _iso(s.scheduled_at), "timezone": s.timezone,
        "repeat_rule": s.repeat_rule or {"freq": "once"},
        "repeat_label": describe_rule(s.repeat_rule),
        "zones": s.zones or [ZONE_ALL], "volume": s.volume,
        "status": s.status, "enabled": bool(s.enabled),
        "max_seconds": s.max_seconds, "error_message": s.error_message,
        "created_by": s.created_by,
        "created_at": _iso(s.created_at), "updated_at": _iso(s.updated_at),
        "next_at": _iso(nxt) if nxt else None,
    }


def _device_view(d: BroadcastDevice, *, now: datetime) -> dict:
    seen = to_kst(d.last_seen)
    online = bool(seen and (now - seen).total_seconds() <= settings.BROADCAST_OFFLINE_SEC)
    return {
        "id": d.id, "device_id": d.device_id, "name": d.name,
        "facility_id": d.facility_id, "zones": d.zones or [ZONE_ALL],
        "output_name": d.output_name, "version": d.version,
        # 원격 접속·현장 확인용 — PC 가 스스로 알려준 값
        "hostname": d.hostname, "local_ip": d.local_ip,
        # 시계가 어긋나면 방송 시각이 어긋난다 — 화면에서 바로 보이게
        "clock_skew_sec": d.clock_skew_sec,
        # 서버가 본 IP (요양원 공유기의 WAN 주소) — 지점 확인용
        "last_ip": d.last_ip,
        "last_seen": _iso(d.last_seen), "online": online,
        "now_playing": d.now_playing, "active": bool(d.active),
        "offline_after_sec": settings.BROADCAST_OFFLINE_SEC,
    }


def _log_view(l: BroadcastLog) -> dict:
    return {
        "id": l.id, "schedule_id": l.schedule_id, "run_id": l.run_id,
        "device_id": l.device_id, "event": l.event, "status": l.status,
        "title": l.title, "started_at": _iso(l.started_at), "ended_at": _iso(l.ended_at),
        "error_message": l.error_message, "actor": l.actor, "created_at": _iso(l.created_at),
    }


# ──────────────────────────────────────────────────────────────
# 조회
# ──────────────────────────────────────────────────────────────
@router.get("/meta")
def meta(_: User = Depends(_manager)):
    """화면이 무엇을 보여줄지 정하는 데 필요한 정보.

    지원하지 않는 기능을 되는 것처럼 그리지 않으려고, 구역도 '지금 실제로
    동작하는지(enabled)'를 서버가 알려준다.
    """
    providers = available_providers()
    return ApiResponse(success=True, data={
        # 방송 PC 를 등록할 수 있는 상태인지 — 아니면 화면에서 먼저 알려준다.
        # (설치하러 가서야 503 을 보는 일이 없도록)
        "enroll_ready": bool((settings.BROADCAST_ENROLL_CODE or "").strip()),
        "tts_ready": any(p["ready"] and p["current"] for p in providers),
        "types": list(BROADCAST_TYPES),
        # Zone 컨트롤러가 없으므로 ALL 만 실제 동작한다. 나머지는 자리만.
        "zones": [{"key": z, "label": "전체" if z == ZONE_ALL else z,
                   "enabled": z == ZONE_ALL} for z in KNOWN_ZONES],
        "zone_note": "구역 분리 장비(Zone Controller)가 없어 지금은 전체 방송만 나갑니다.",
        "tts_providers": providers,
        "max_upload_mb": settings.BROADCAST_MAX_UPLOAD_MB,
        "max_seconds_default": settings.BROADCAST_MAX_SECONDS,
        "allowed_ext": sorted(media_svc.ALLOWED.keys()),
        "timezone": "Asia/Seoul",
    })


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: User = Depends(_manager)):
    """방송 관리 첫 화면 — 지금 상태 / 다음 예약 / 오늘 일정 / PC / 최근 기록."""
    now = now_kst()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1) - timedelta(seconds=1)

    devices = db.query(BroadcastDevice).filter(BroadcastDevice.active == True).all()  # noqa: E712
    schedules = db.query(BroadcastSchedule).filter(BroadcastSchedule.enabled == True).all()  # noqa: E712

    # 오늘 일정 — 회차 단위로 펼친다
    today: List[dict] = []
    for s in schedules:
        for at in occurrences(s.scheduled_at, s.repeat_rule, start=day_start, end=day_end):
            today.append({"schedule_id": s.id, "title": s.title, "type": s.type,
                          "at": at.isoformat(), "status": s.status,
                          "past": at < now, "zones": s.zones or [ZONE_ALL]})
    today.sort(key=lambda x: x["at"])

    # 오늘 회차의 실제 결과를 붙여준다
    if today:
        runs = {(r.schedule_id, to_kst(r.occurrence_at).isoformat()): r
                for r in db.query(BroadcastRun).filter(
                    BroadcastRun.occurrence_at >= day_start,
                    BroadcastRun.occurrence_at <= day_end).all()}
        for t in today:
            r = runs.get((t["schedule_id"], t["at"]))
            t["run_status"] = r.status if r else None
            t["device_id"] = r.device_id if r else None

    # 다음 예약
    nxt = None
    for s in schedules:
        if s.status != ST_READY:
            continue
        n = next_occurrence(s.scheduled_at, s.repeat_rule, after=now)
        if n and (nxt is None or n < nxt["at"]):
            nxt = {"at": n, "schedule": s}

    playing = db.query(BroadcastRun).filter(BroadcastRun.status == RUN_PLAYING).all()
    recent = (db.query(BroadcastLog).filter(BroadcastLog.event == "PLAY")
              .order_by(BroadcastLog.created_at.desc()).limit(15).all())

    # 방송 PC 들이 보고한 시계 차이 — 서버 시계가 틀어졌는지 알 수 있는 유일한 단서다.
    # (서버에는 비교할 기준이 없으므로 현장 PC 의 시계를 참고한다)
    skews = [d.clock_skew_sec for d in devices
             if d.clock_skew_sec is not None and _device_view(d, now=now)["online"]]
    clock_skew = max(skews, key=abs) if skews else None

    return ApiResponse(success=True, data={
        "now": now.isoformat(),
        "server_clock_skew_sec": clock_skew,
        "playing": [{"run_id": r.id, "schedule_id": r.schedule_id, "device_id": r.device_id,
                     "started_at": _iso(r.started_at)} for r in playing],
        "next": ({"at": nxt["at"].isoformat(), **_sched_view(nxt["schedule"])} if nxt else None),
        "today": today,
        "devices": [_device_view(d, now=now) for d in devices],
        "online_count": sum(1 for d in devices if _device_view(d, now=now)["online"]),
        "recent": [_log_view(l) for l in recent],
        "enabled": settings.BROADCAST_ENABLED,
    })


@router.get("/schedules")
def list_schedules(include_disabled: bool = Query(True),
                   db: Session = Depends(get_db), _: User = Depends(_manager)):
    q = db.query(BroadcastSchedule)
    if not include_disabled:
        q = q.filter(BroadcastSchedule.enabled == True)  # noqa: E712
    rows = q.order_by(BroadcastSchedule.scheduled_at.desc()).all()
    now = now_kst()
    return ApiResponse(success=True, data=[
        _sched_view(s, nxt=next_occurrence(s.scheduled_at, s.repeat_rule, after=now)) for s in rows])


@router.get("/logs")
def list_logs(limit: int = Query(100, le=500), schedule_id: Optional[str] = Query(None),
              db: Session = Depends(get_db), _: User = Depends(_manager)):
    q = db.query(BroadcastLog)
    if schedule_id:
        q = q.filter(BroadcastLog.schedule_id == schedule_id)
    rows = q.order_by(BroadcastLog.created_at.desc()).limit(limit).all()
    return ApiResponse(success=True, data=[_log_view(l) for l in rows])


@router.get("/devices")
def list_devices(db: Session = Depends(get_db), _: User = Depends(_manager)):
    now = now_kst()
    rows = db.query(BroadcastDevice).order_by(BroadcastDevice.created_at.asc()).all()
    return ApiResponse(success=True, data=[_device_view(d, now=now) for d in rows])


# ──────────────────────────────────────────────────────────────
# 음원 — 업로드 · TTS
# ──────────────────────────────────────────────────────────────
@router.post("/media/upload")
async def upload_media(file: UploadFile = File(...),
                       db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    data = await file.read()
    try:
        ext, mime, kind = media_svc.validate(file.filename, data)
    except media_svc.MediaError as e:
        raise HTTPException(400, str(e))
    # TTS 와 같은 음량으로 맞춘다 — 방송마다 소리 크기가 들쭉날쭉하면
    # 앞 방송에 맞춰 앰프를 올려둔 상태에서 다음 방송이 크게 나간다.
    data, ext, norm = media_svc.normalize_upload(data, ext)
    mime, kind = media_svc.ALLOWED.get(ext, (mime, kind))
    saved = media_svc.save_bytes(data, ext=ext, stem=file.filename)
    m = BroadcastMedia(kind=kind, filename=saved["filename"], url=saved["url"], mime=mime,
                       size_bytes=saved["size_bytes"], sha256=saved["sha256"],
                       duration_sec=saved["duration_sec"],
                       created_by=getattr(current_user, "name", None))
    db.add(m); db.commit(); db.refresh(m)
    return ApiResponse(success=True, data={
        "id": m.id, "kind": m.kind, "url": m.url, "mime": m.mime,
        "size_bytes": m.size_bytes, "duration_sec": m.duration_sec, "sha256": m.sha256,
        # 음량을 얼마나 키웠는지 — 원본이 너무 작으면 화면에서 미리 알려준다
        "gain_db": norm.get("gain_db"), "still_quiet": norm.get("still_quiet"),
        "audio_only": norm.get("audio_only")})


class TTSBody(BaseModel):
    text: str
    voice: Optional[str] = None
    speed: float = 1.0
    provider: Optional[str] = None


@router.post("/media/tts")
def make_tts(body: TTSBody, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    """문구를 음성 파일로. 같은 문구·목소리는 다시 만들지 않고 재사용한다."""
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "읽을 문구를 입력해주세요.")
    if len(text) > 1000:
        raise HTTPException(400, "문구가 너무 깁니다. (최대 1000자)")

    provider = get_provider(body.provider)
    key = provider.cache_key(text, voice=body.voice, speed=body.speed)
    hit = db.query(BroadcastMedia).filter(BroadcastMedia.text_hash == key).first()
    if hit:
        return ApiResponse(success=True, data={
            "id": hit.id, "url": hit.url, "duration_sec": hit.duration_sec,
            "sha256": hit.sha256, "reused": True})

    try:
        res = provider.synthesize(text, voice=body.voice, speed=body.speed)
    except TTSError as e:
        raise HTTPException(502, str(e))

    # 만들자마자 음량을 최대로 키운다 — Agent 는 줄이기만 할 수 있어서,
    # 원본이 작으면 현장에서 앰프를 올려야 하고 그러면 잡음도 함께 커진다.
    audio = media_svc.normalize_wav(res.audio) if res.ext == "wav" else res.audio
    saved = media_svc.save_bytes(audio, ext=f".{res.ext}", stem=text[:20])
    if saved.get("duration_sec") is None and res.ext == "wav":
        saved["duration_sec"] = media_svc.wav_duration(audio)   # ffprobe 없이도 길이를 안다
    m = BroadcastMedia(kind=TYPE_TTS, filename=saved["filename"], url=saved["url"],
                       mime=res.mime, size_bytes=saved["size_bytes"], sha256=saved["sha256"],
                       duration_sec=saved["duration_sec"], text_hash=key,
                       tts_provider=res.provider, tts_voice=res.voice,
                       created_by=getattr(current_user, "name", None))
    db.add(m); db.commit(); db.refresh(m)
    return ApiResponse(success=True, data={
        "id": m.id, "url": m.url, "duration_sec": m.duration_sec,
        "sha256": m.sha256, "provider": res.provider, "voice": res.voice, "reused": False})


# ──────────────────────────────────────────────────────────────
# 예약 CRUD
# ──────────────────────────────────────────────────────────────
class ScheduleBody(BaseModel):
    title: str
    type: str = TYPE_TTS
    text: Optional[str] = None
    media_id: Optional[str] = None
    scheduled_at: Optional[str] = None       # 'YYYY-MM-DDTHH:MM' (KST). 없으면 지금 = 즉시 방송
    repeat_rule: Optional[Dict[str, Any]] = None
    zones: Optional[List[str]] = None
    volume: int = 70
    max_seconds: Optional[int] = None
    enabled: bool = True


def _parse_at(v: Optional[str]) -> datetime:
    if not v:
        return now_kst()
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "일시 형식이 올바르지 않습니다. (예: 2026-08-20T14:30)")
    return dt.replace(tzinfo=KST) if dt.tzinfo is None else dt.astimezone(KST)


def _clean_zones(zones: Optional[List[str]]) -> List[str]:
    """지금 실제로 동작하는 구역만 남긴다 — 되지도 않는 걸 저장해두면 나중에 거짓말이 된다."""
    want = [z for z in (zones or []) if z in KNOWN_ZONES]
    if not want or ZONE_ALL in want:
        return [ZONE_ALL]
    # Zone 컨트롤러가 붙기 전에는 부분 구역을 약속할 수 없다
    return [ZONE_ALL]


def _resolve_media(db: Session, body_type: str, media_id: Optional[str]) -> Optional[BroadcastMedia]:
    if not media_id:
        return None
    m = db.query(BroadcastMedia).filter(BroadcastMedia.id == media_id).first()
    if not m:
        raise HTTPException(404, "음원을 찾을 수 없습니다.")
    return m


@router.post("/schedules")
def create_schedule(body: ScheduleBody, db: Session = Depends(get_db),
                    current_user: User = Depends(_manager)):
    if not body.title.strip():
        raise HTTPException(400, "제목을 입력해주세요.")
    if body.type not in BROADCAST_TYPES:
        raise HTTPException(400, f"방송 종류가 올바르지 않습니다: {body.type}")

    m = _resolve_media(db, body.type, body.media_id)
    if body.type == TYPE_TTS and not m and not (body.text or "").strip():
        raise HTTPException(400, "읽을 문구 또는 만들어둔 음성이 필요합니다.")
    if body.type in (TYPE_AUDIO, TYPE_VIDEO) and not m:
        raise HTTPException(400, "재생할 파일을 먼저 올려주세요.")

    max_sec = body.max_seconds or settings.BROADCAST_MAX_SECONDS
    if m and m.duration_sec and m.duration_sec > max_sec:
        raise HTTPException(400, f"음원 길이({m.duration_sec}초)가 최대 방송시간({max_sec}초)보다 깁니다.")

    s = BroadcastSchedule(
        title=body.title.strip(), type=body.type,
        text=(body.text or "").strip() or None,
        media_id=m.id if m else None, media_url=m.url if m else None,
        scheduled_at=_parse_at(body.scheduled_at), timezone="Asia/Seoul",
        repeat_rule=normalize_rule(body.repeat_rule),
        zones=_clean_zones(body.zones),
        volume=min(max(int(body.volume), 0), 100),
        max_seconds=min(max(int(max_sec), 5), 3600),
        status=ST_READY if m else ST_DRAFT,
        enabled=bool(body.enabled),
        created_by=getattr(current_user, "name", None),
        created_by_id=getattr(current_user, "id", None),
    )
    db.add(s)
    _audit(db, event="CREATE", user=current_user, schedule_id=s.id, title=s.title)
    db.commit(); db.refresh(s)
    return ApiResponse(success=True, data=_sched_view(
        s, nxt=next_occurrence(s.scheduled_at, s.repeat_rule)))


class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    media_id: Optional[str] = None
    scheduled_at: Optional[str] = None
    repeat_rule: Optional[Dict[str, Any]] = None
    zones: Optional[List[str]] = None
    volume: Optional[int] = None
    max_seconds: Optional[int] = None
    enabled: Optional[bool] = None


@router.patch("/schedules/{sid}")
def update_schedule(sid: str, body: ScheduleUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(_manager)):
    s = db.query(BroadcastSchedule).filter(BroadcastSchedule.id == sid).first()
    if not s:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    if body.title is not None and body.title.strip():
        s.title = body.title.strip()
    if body.text is not None:
        s.text = body.text.strip() or None
    if body.media_id is not None:
        m = _resolve_media(db, s.type, body.media_id)
        s.media_id, s.media_url = (m.id, m.url) if m else (None, None)
        s.status = ST_READY if m else ST_DRAFT
    if body.scheduled_at is not None:
        s.scheduled_at = _parse_at(body.scheduled_at)
    if body.repeat_rule is not None:
        s.repeat_rule = normalize_rule(body.repeat_rule)
    if body.zones is not None:
        s.zones = _clean_zones(body.zones)
    if body.volume is not None:
        s.volume = min(max(int(body.volume), 0), 100)
    if body.max_seconds is not None:
        s.max_seconds = min(max(int(body.max_seconds), 5), 3600)
    if body.enabled is not None:
        s.enabled = bool(body.enabled)
    s.updated_at = now_kst()
    _audit(db, event="UPDATE", user=current_user, schedule_id=s.id, title=s.title)
    db.commit(); db.refresh(s)
    return ApiResponse(success=True, data=_sched_view(
        s, nxt=next_occurrence(s.scheduled_at, s.repeat_rule)))


@router.delete("/schedules/{sid}")
def delete_schedule(sid: str, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    s = db.query(BroadcastSchedule).filter(BroadcastSchedule.id == sid).first()
    if not s:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    title = s.title
    # 아직 안 나간 회차만 정리한다 — 지나간 기록은 남겨야 '무슨 방송이 나갔나'를 볼 수 있다
    (db.query(BroadcastRun)
       .filter(BroadcastRun.schedule_id == sid, BroadcastRun.status == RUN_PENDING)
       .delete(synchronize_session=False))
    db.delete(s)
    _audit(db, event="DELETE", user=current_user, schedule_id=sid, title=title)
    db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


# ──────────────────────────────────────────────────────────────
# 즉시 방송 · 중지
# ──────────────────────────────────────────────────────────────
@router.post("/schedules/{sid}/play-now")
def play_now(sid: str, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    """지금 바로 내보낸다 — 새 회차를 '지금'으로 만들어 Agent가 집어가게 한다."""
    s = db.query(BroadcastSchedule).filter(BroadcastSchedule.id == sid).first()
    if not s:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    if s.status != ST_READY:
        raise HTTPException(400, "아직 재생할 음원이 준비되지 않았습니다.")
    # 즉시 방송은 언제나 '지금'이다. 예약 시각을 빌려 쓰면 그 시각까지 기다리게 되고,
    # 이미 지난 시각이면 아예 안 나간다. (중복은 sync 에서 막는다 —
    # 이 예약의 다른 회차가 근처에 있으면 그쪽을 내려보내지 않는다)
    at = now_kst().replace(microsecond=0)
    # 버튼을 연타하면 초가 달라 회차가 여러 개 생기고, 그만큼 방송이 반복된다.
    # 같은 예약의 '아직 안 나간(또는 나가는 중인)' 최근 회차가 있으면 그걸 그대로 쓴다.
    recent = (db.query(BroadcastRun)
                .filter(BroadcastRun.schedule_id == s.id,
                        BroadcastRun.status.in_([RUN_PENDING, RUN_PLAYING]),
                        BroadcastRun.occurrence_at >= at - timedelta(minutes=15),
                        BroadcastRun.occurrence_at <= at + timedelta(minutes=15))
                .order_by(BroadcastRun.occurrence_at.desc()).first())
    run = recent
    created = False
    if run is None:
        run = BroadcastRun(schedule_id=s.id, occurrence_at=at, status=RUN_PENDING)
        db.add(run)
        created = True

    # 즉시 방송은 '빨리' 나가야 의미가 있다. Agent 의 동기화 주기(기본 5분)를
    # 기다리면 늦으므로, 다시 받아가라고 알려 heartbeat 주기(기본 30초) 안에 전달한다.
    db.add(BroadcastCommand(device_id=None, command="RESYNC",
                            payload={"reason": "play_now", "schedule_id": s.id},
                            issued_by=getattr(current_user, "name", None)))
    if created:
        _audit(db, event="PLAY_NOW", user=current_user, schedule_id=s.id, title=s.title)
    try:
        db.commit()
    except IntegrityError:                 # 동시에 두 명이 눌렀을 때
        db.rollback()
        run = (db.query(BroadcastRun)
                 .filter(BroadcastRun.schedule_id == s.id,
                         BroadcastRun.occurrence_at == at).first())
        if run is None:
            raise HTTPException(409, "지금 방송을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.")
    db.refresh(run)
    return ApiResponse(success=True, data={"run_id": run.id, "at": at.isoformat()},
                       message="곧 방송됩니다. (방송 PC가 온라인일 때)")


class StopBody(BaseModel):
    reason: Optional[str] = None


@router.post("/stop")
def stop_all(body: StopBody, db: Session = Depends(get_db), current_user: User = Depends(_manager)):
    """지금 나가는 방송을 즉시 중지 (Emergency Stop).

    소방·비상방송 설비는 건드리지 않는다. 우리 방송만 멈춘다.
    """
    db.add(BroadcastCommand(device_id=None, command="EMERGENCY_STOP",
                            payload={"reason": body.reason},
                            issued_by=getattr(current_user, "name", None)))
    # 진행 중으로 표시된 회차는 즉시 중단으로 마감한다 — 유령 재생이 남지 않게
    stopped = (db.query(BroadcastRun).filter(BroadcastRun.status == RUN_PLAYING).all())
    for r in stopped:
        r.status = RUN_SKIPPED
        r.ended_at = now_kst()
        r.error_message = "관리자 즉시 중지"
    _audit(db, event="EMERGENCY_STOP", user=current_user, status="SUCCESS",
           error=body.reason)
    db.commit()
    return ApiResponse(success=True, data={"stopped": len(stopped)},
                       message="중지 명령을 보냈습니다.")


class AnnounceBody(BaseModel):
    """문구 하나로 바로 방송하기 — 프로그램 안내처럼 그때그때 만드는 방송용."""
    title: str
    text: str
    volume: int = 70
    voice: Optional[str] = None
    preview_only: bool = False      # 소리는 내지 않고 음성만 만들어 들어보기


@router.post("/announce")
def announce(body: AnnounceBody, db: Session = Depends(get_db),
             current_user: User = Depends(_manager)):
    """문구를 받아 음성을 만들고 즉시 방송한다.

    예약을 만들고 음성을 만들고 즉시방송을 누르는 세 단계를, 부르는 쪽에서
    한 번에 끝내라고 묶어둔 것이다. 프로그램 안내처럼 '지금 이 문구로'가
    필요한 곳에서 쓴다.

    preview_only 면 음성만 만들어 돌려준다 — 스피커로는 나가지 않는다.
    어르신들이 생활하는 공간이라, 문구를 확인하고 내보낼 수 있어야 한다.
    """
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "읽을 문구를 입력해주세요.")
    if len(text) > 1000:
        raise HTTPException(400, "문구가 너무 깁니다. (최대 1000자)")

    provider = get_provider()
    key = provider.cache_key(text, voice=body.voice)
    m = db.query(BroadcastMedia).filter(BroadcastMedia.text_hash == key).first()
    if not m:
        try:
            res = provider.synthesize(text, voice=body.voice)
        except TTSError as e:
            raise HTTPException(502, str(e))
        audio = media_svc.normalize_wav(res.audio) if res.ext == "wav" else res.audio
        saved = media_svc.save_bytes(audio, ext=f".{res.ext}", stem=text[:20])
        if saved.get("duration_sec") is None and res.ext == "wav":
            saved["duration_sec"] = media_svc.wav_duration(audio)
        m = BroadcastMedia(kind=TYPE_TTS, filename=saved["filename"], url=saved["url"],
                           mime=res.mime, size_bytes=saved["size_bytes"], sha256=saved["sha256"],
                           duration_sec=saved["duration_sec"], text_hash=key,
                           tts_provider=res.provider, tts_voice=res.voice,
                           created_by=getattr(current_user, "name", None))
        db.add(m); db.commit(); db.refresh(m)

    if body.preview_only:
        return ApiResponse(success=True, data={
            "media_id": m.id, "url": m.url, "duration_sec": m.duration_sec,
            "text": text, "played": False})

    now = now_kst().replace(microsecond=0)
    sch = BroadcastSchedule(
        title=body.title.strip()[:200] or "안내방송", type=TYPE_TTS, text=text,
        media_id=m.id, media_url=m.url,
        scheduled_at=now, timezone="Asia/Seoul", repeat_rule={"freq": "once"},
        zones=[ZONE_ALL], volume=min(max(int(body.volume), 0), 100),
        max_seconds=settings.BROADCAST_MAX_SECONDS, status=ST_READY, enabled=True,
        created_by=getattr(current_user, "name", None),
        created_by_id=getattr(current_user, "id", None))
    db.add(sch); db.flush()
    run = BroadcastRun(schedule_id=sch.id, occurrence_at=now, status=RUN_PENDING)
    db.add(run)
    # 바로 나가야 하므로 Agent 에게 다시 받아가라고 알린다(동기화 주기를 기다리지 않게)
    db.add(BroadcastCommand(device_id=None, command="RESYNC",
                            payload={"reason": "announce"},
                            issued_by=getattr(current_user, "name", None)))
    _audit(db, event="ANNOUNCE", user=current_user, schedule_id=sch.id, title=sch.title)
    db.commit()
    return ApiResponse(success=True, data={
        "schedule_id": sch.id, "run_id": run.id, "media_id": m.id, "url": m.url,
        "duration_sec": m.duration_sec, "text": text, "played": True},
        message="곧 방송됩니다. (방송 PC가 온라인일 때)")


@router.post("/schedules/{sid}/preview")
def preview(sid: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    """미리듣기 — 브라우저에서 재생할 수 있게 음원 주소를 돌려준다.

    (스피커로 나가지 않는다. 관리자 PC에서만 들린다)
    """
    s = db.query(BroadcastSchedule).filter(BroadcastSchedule.id == sid).first()
    if not s:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    if not s.media_url:
        raise HTTPException(400, "아직 준비된 음원이 없습니다.")
    return ApiResponse(success=True, data={"url": s.media_url, "type": s.type})
