"""안내방송 — Broadcast Agent(방송 PC) 전용 API.

사용자 로그인(JWT)과 완전히 분리한다. 방송 PC는 사람이 아니고, 24시간 켜져 있고,
직원 계정이 바뀌어도 계속 돌아야 한다. 그래서 기기별 토큰을 따로 발급한다.

흐름:
  register(등록코드)  → 토큰 발급
  heartbeat           → 살아있음 + 지금 재생 중인 것 + 받아갈 명령
  sync                → 앞으로 N일치 회차 + 받아야 할 음원 목록
  claim               → 이 회차는 내가 튼다 (DB UNIQUE 로 한 번만 성공)
  report              → 결과 보고

claim 이 이 파일의 핵심이다. 여기서 막지 못하면 같은 방송이 두 번 나간다.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.broadcast import (
    BroadcastSchedule, BroadcastMedia, BroadcastDevice, BroadcastRun,
    BroadcastLog, BroadcastCommand,
    ST_READY, RUN_PENDING, RUN_PLAYING, RUN_SUCCESS, RUN_FAILED, RUN_SKIPPED,
    ZONE_ALL, now_kst,
)
from app.schemas.response import ApiResponse
from app.services.broadcast_schedule import KST, occurrences, to_kst


def _client_ip(request: Request) -> Optional[str]:
    """Caddy 뒤에서도 진짜 접속 IP를 본다 — tracking.get_client_ip 와 같은 방식."""
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    real = request.headers.get("X-Real-IP")
    if real:
        return real.strip()[:64]
    return getattr(request.client, "host", None) if request.client else None

logger = logging.getLogger(__name__)
router = APIRouter()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _device(
    x_device_token: Optional[str] = Header(None, alias="X-Device-Token"),
    db: Session = Depends(get_db),
) -> BroadcastDevice:
    """토큰으로 기기를 찾는다. 토큰 원문은 저장하지 않으므로 해시로 조회한다."""
    if not x_device_token:
        raise HTTPException(401, "기기 토큰이 필요합니다.")
    d = (db.query(BroadcastDevice)
           .filter(BroadcastDevice.token_hash == _hash(x_device_token)).first())
    if not d or not d.active:
        raise HTTPException(401, "등록되지 않았거나 사용 중지된 기기입니다.")
    return d


# ──────────────────────────────────────────────────────────────
# 등록
# ──────────────────────────────────────────────────────────────
class RegisterBody(BaseModel):
    enroll_code: str
    device_id: str
    name: Optional[str] = None
    facility_id: str = "default"
    version: Optional[str] = None
    output_name: Optional[str] = None
    hostname: Optional[str] = None
    local_ip: Optional[str] = None


@router.post("/register")
def register(body: RegisterBody, request: Request, db: Session = Depends(get_db)):
    """설치할 때 한 번. 등록코드가 맞아야 토큰을 준다.

    같은 device_id 로 다시 등록하면 토큰이 새로 발급된다(재설치·토큰 분실 대응).
    """
    code = (settings.BROADCAST_ENROLL_CODE or "").strip()
    if not code:
        # .env 만 고치고 재빌드를 안 한 경우가 대부분이라, 그 사실까지 알려준다.
        raise HTTPException(503,
            "서버에 등록코드(BROADCAST_ENROLL_CODE)가 설정돼 있지 않습니다. "
            ".env 에 넣었다면 이미지 재빌드가 필요합니다 "
            "(docker compose build backend && docker compose up -d --force-recreate backend).")
    # bytes 로 비교한다 — str 끼리 비교하면 한글 같은 비ASCII 입력에서 TypeError 가 나
    # 403 이어야 할 자리가 500 이 된다. (비교 시간은 여전히 입력에 좌우되지 않는다)
    if not secrets.compare_digest(body.enroll_code.strip().encode("utf-8"), code.encode("utf-8")):
        raise HTTPException(403, "등록코드가 올바르지 않습니다.")
    did = (body.device_id or "").strip()
    if not did:
        raise HTTPException(400, "device_id 가 필요합니다.")

    token = secrets.token_urlsafe(32)
    d = db.query(BroadcastDevice).filter(BroadcastDevice.device_id == did).first()
    if not d:
        d = BroadcastDevice(device_id=did, facility_id=body.facility_id or "default",
                            name=body.name or did, zones=[ZONE_ALL])
        db.add(d)
    d.name = body.name or d.name
    d.version = body.version or d.version
    d.output_name = body.output_name or d.output_name
    d.token_hash = _hash(token)
    d.active = True
    d.last_seen = now_kst()
    d.last_ip = _client_ip(request)
    d.hostname = body.hostname or d.hostname
    d.local_ip = body.local_ip or d.local_ip
    db.add(BroadcastLog(event="DEVICE_REGISTER", device_id=did, status="SUCCESS",
                        title=d.name))
    db.commit()
    return ApiResponse(success=True, data={
        "device_token": token, "device_id": d.device_id, "name": d.name,
        "offline_after_sec": settings.BROADCAST_OFFLINE_SEC,
    }, message="등록되었습니다. 토큰을 안전하게 보관하세요.")


# ──────────────────────────────────────────────────────────────
# heartbeat
# ──────────────────────────────────────────────────────────────
class HeartbeatBody(BaseModel):
    now_playing: Optional[str] = None
    version: Optional[str] = None
    output_name: Optional[str] = None
    hostname: Optional[str] = None
    local_ip: Optional[str] = None


@router.post("/heartbeat")
def heartbeat(body: HeartbeatBody, request: Request,
              d: BroadcastDevice = Depends(_device), db: Session = Depends(get_db)):
    """살아있다고 알리고, 처리할 명령이 있으면 받아간다."""
    d.last_seen = now_kst()
    d.now_playing = body.now_playing
    if body.version:
        d.version = body.version
    if body.output_name:
        d.output_name = body.output_name
    if body.hostname:
        d.hostname = body.hostname
    if body.local_ip:
        d.local_ip = body.local_ip
    d.last_ip = _client_ip(request)

    cmds = (db.query(BroadcastCommand)
              .filter(BroadcastCommand.acked_at.is_(None))
              .filter((BroadcastCommand.device_id == d.device_id) | (BroadcastCommand.device_id.is_(None)))
              .order_by(BroadcastCommand.created_at.asc()).limit(20).all())
    out = [{"id": c.id, "command": c.command, "payload": c.payload or {}} for c in cmds]
    for c in cmds:
        c.acked_at = now_kst()
    db.commit()
    return ApiResponse(success=True, data={
        "server_time": now_kst().isoformat(),
        "commands": out,
        "sync_days": settings.BROADCAST_SYNC_DAYS,
    })


# ──────────────────────────────────────────────────────────────
# 동기화
# ──────────────────────────────────────────────────────────────
@router.get("/sync")
def sync(d: BroadcastDevice = Depends(_device), db: Session = Depends(get_db)):
    """앞으로 N일치 '몇 시에 무엇을' 목록.

    반복 규칙을 그대로 내려보내지 않는다 — 회차 시각까지 서버가 계산해서 준다.
    규칙 해석이 두 곳에 있으면 언젠가 서버와 Agent 가 다른 답을 낸다.

    인터넷이 끊겨도 이 응답만 캐시돼 있으면 그 기간은 정상 방송된다.
    """
    now = now_kst()
    end = now + timedelta(days=settings.BROADCAST_SYNC_DAYS)
    # 조금 과거까지 포함한다 — Agent가 잠깐 죽었다 살아났을 때 직전 회차를 만회
    start = now - timedelta(minutes=10)

    scheds = (db.query(BroadcastSchedule)
                .filter(BroadcastSchedule.enabled == True,          # noqa: E712
                        BroadcastSchedule.status == ST_READY).all())
    media_ids = {s.media_id for s in scheds if s.media_id}
    media = {m.id: m for m in db.query(BroadcastMedia).filter(BroadcastMedia.id.in_(media_ids)).all()} if media_ids else {}

    items: List[Dict[str, Any]] = []
    for s in scheds:
        m = media.get(s.media_id) if s.media_id else None
        if not m:
            continue                      # 음원이 없으면 틀 수 없다
        for at in occurrences(s.scheduled_at, s.repeat_rule, start=start, end=end):
            items.append({
                "schedule_id": s.id,
                "occurrence_at": at.isoformat(),
                "title": s.title,
                "type": s.type,
                "volume": s.volume,
                "zones": s.zones or [ZONE_ALL],
                "max_seconds": s.max_seconds,
                "media": {"id": m.id, "url": m.url, "sha256": m.sha256,
                          "filename": m.filename, "duration_sec": m.duration_sec},
            })
    items.sort(key=lambda x: x["occurrence_at"])

    # 즉시 방송처럼 서버가 직접 만든 회차도 함께 (반복 계산으로는 안 나온다)
    adhoc = (db.query(BroadcastRun)
               .filter(BroadcastRun.status == RUN_PENDING,
                       BroadcastRun.occurrence_at >= start,
                       BroadcastRun.occurrence_at <= end).all())
    known = {(i["schedule_id"], i["occurrence_at"]) for i in items}
    for r in adhoc:
        at = to_kst(r.occurrence_at)
        key = (r.schedule_id, at.isoformat())
        if key in known:
            continue
        s = next((x for x in scheds if x.id == r.schedule_id), None)
        m = media.get(s.media_id) if s and s.media_id else None
        if not s or not m:
            continue
        items.append({
            "schedule_id": s.id, "occurrence_at": at.isoformat(), "title": s.title,
            # 즉시 방송(관리자가 지금 누른 것) — 예약과 달리 조금 늦게 받아도 내보낸다
            "immediate": True,
            "type": s.type, "volume": s.volume, "zones": s.zones or [ZONE_ALL],
            "max_seconds": s.max_seconds,
            "media": {"id": m.id, "url": m.url, "sha256": m.sha256,
                      "filename": m.filename, "duration_sec": m.duration_sec},
        })
    items.sort(key=lambda x: x["occurrence_at"])

    d.last_seen = now_kst()
    db.commit()
    return ApiResponse(success=True, data={
        "server_time": now.isoformat(),
        "timezone": "Asia/Seoul",
        "horizon_days": settings.BROADCAST_SYNC_DAYS,
        "max_retry": settings.BROADCAST_MAX_RETRY,
        "items": items,
    })


# ──────────────────────────────────────────────────────────────
# 회차 선점 — 중복 재생을 막는 자리
# ──────────────────────────────────────────────────────────────
class ClaimBody(BaseModel):
    schedule_id: str
    occurrence_at: str


@router.post("/claim")
def claim(body: ClaimBody, d: BroadcastDevice = Depends(_device), db: Session = Depends(get_db)):
    """'이 회차는 내가 튼다'.

    (schedule_id, occurrence_at) 에 UNIQUE 가 걸려 있어, 동시에 여러 대가 요청해도
    한 대만 성공한다. 이미 누가 잡았거나 끝난 회차면 granted=False 를 돌려준다.
    Agent 는 granted=False 면 절대 재생하지 않는다.
    """
    at = to_kst(datetime.fromisoformat(body.occurrence_at.replace("Z", "+00:00")))
    s = db.query(BroadcastSchedule).filter(BroadcastSchedule.id == body.schedule_id).first()
    if not s:
        raise HTTPException(404, "예약을 찾을 수 없습니다.")
    if not s.enabled or s.status != ST_READY:
        return ApiResponse(success=True, data={"granted": False, "reason": "예약이 꺼져 있거나 준비되지 않음"})

    # 너무 늦은 회차는 아예 틀지 않는다 — 3시간 전 점심 안내가 갑자기 나가면 안 된다
    late = (now_kst() - at).total_seconds()
    if late > 15 * 60:
        run = _get_or_create_run(db, s.id, at)
        if run.status == RUN_PENDING:
            run.status = RUN_SKIPPED
            run.error_message = f"시간이 지나 건너뜀({int(late)}초 경과)"
            run.ended_at = now_kst()
            db.commit()
        return ApiResponse(success=True, data={"granted": False, "reason": "시간이 지난 회차"})

    try:
        run = _get_or_create_run(db, s.id, at)
    except IntegrityError:
        db.rollback()
        run = (db.query(BroadcastRun)
                 .filter(BroadcastRun.schedule_id == s.id, BroadcastRun.occurrence_at == at).first())

    if run is None:
        return ApiResponse(success=True, data={"granted": False, "reason": "회차를 만들 수 없음"})

    # 이미 끝났거나 다른 기기가 재생 중이면 넘기지 않는다
    if run.status in (RUN_SUCCESS, RUN_SKIPPED):
        return ApiResponse(success=True, data={"granted": False, "reason": f"이미 처리됨({run.status})"})
    if run.status == RUN_PLAYING and run.device_id and run.device_id != d.device_id:
        started = to_kst(run.started_at)
        # 재생 중인 기기가 죽었을 수 있다 — 최대 방송시간이 지나면 회수한다
        if started and (now_kst() - started).total_seconds() < (s.max_seconds + 60):
            return ApiResponse(success=True, data={"granted": False, "reason": "다른 기기가 재생 중"})
    if run.status == RUN_FAILED and run.attempt > settings.BROADCAST_MAX_RETRY:
        return ApiResponse(success=True, data={"granted": False, "reason": "재시도 한도 초과"})

    run.device_id = d.device_id
    run.status = RUN_PLAYING
    run.attempt = (run.attempt or 0) + 1
    run.claimed_at = now_kst()
    run.started_at = now_kst()
    db.commit()
    return ApiResponse(success=True, data={
        "granted": True, "run_id": run.id, "attempt": run.attempt,
        "max_seconds": s.max_seconds, "volume": s.volume,
    })


def _get_or_create_run(db: Session, schedule_id: str, at: datetime) -> BroadcastRun:
    run = (db.query(BroadcastRun)
             .filter(BroadcastRun.schedule_id == schedule_id,
                     BroadcastRun.occurrence_at == at).first())
    if run:
        return run
    run = BroadcastRun(schedule_id=schedule_id, occurrence_at=at, status=RUN_PENDING)
    db.add(run)
    db.flush()      # UNIQUE 위반을 여기서 바로 알기 위해
    return run


# ──────────────────────────────────────────────────────────────
# 결과 보고
# ──────────────────────────────────────────────────────────────
class ReportBody(BaseModel):
    # 보통은 claim 때 받은 run_id 로 보고한다.
    run_id: Optional[str] = None
    # 인터넷이 끊긴 채로 방송한 경우엔 claim 을 못 했으므로 run_id 가 없다.
    # 그때는 '어느 예약의 몇 시 회차였는지'로 보고한다 — 그래야 나중에라도 기록이 남는다.
    schedule_id: Optional[str] = None
    occurrence_at: Optional[str] = None
    status: str                       # SUCCESS | FAILED | SKIPPED
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    error_message: Optional[str] = None
    offline: bool = False             # 오프라인 중 재생분인지


@router.post("/report")
def report(body: ReportBody, d: BroadcastDevice = Depends(_device), db: Session = Depends(get_db)):
    run = None
    if body.run_id:
        run = db.query(BroadcastRun).filter(BroadcastRun.id == body.run_id).first()
    elif body.schedule_id and body.occurrence_at:
        at = to_kst(datetime.fromisoformat(body.occurrence_at.replace("Z", "+00:00")))
        try:
            run = _get_or_create_run(db, body.schedule_id, at)
            run.device_id = run.device_id or d.device_id
        except IntegrityError:
            db.rollback()
            run = (db.query(BroadcastRun)
                     .filter(BroadcastRun.schedule_id == body.schedule_id,
                             BroadcastRun.occurrence_at == at).first())
    if not run:
        raise HTTPException(404, "실행 기록을 찾을 수 없습니다.")
    if run.device_id and run.device_id != d.device_id:
        raise HTTPException(403, "다른 기기의 실행 기록입니다.")

    st = body.status if body.status in (RUN_SUCCESS, RUN_FAILED, RUN_SKIPPED) else RUN_FAILED
    run.status = st
    run.error_message = (body.error_message or "")[:2000] or None
    if body.started_at:
        run.started_at = to_kst(datetime.fromisoformat(body.started_at.replace("Z", "+00:00")))
    run.ended_at = (to_kst(datetime.fromisoformat(body.ended_at.replace("Z", "+00:00")))
                    if body.ended_at else now_kst())

    s = db.query(BroadcastSchedule).filter(BroadcastSchedule.id == run.schedule_id).first()
    db.add(BroadcastLog(
        event="PLAY", schedule_id=run.schedule_id, run_id=run.id, device_id=d.device_id,
        status=st, title=s.title if s else None,
        started_at=run.started_at, ended_at=run.ended_at,
        error_message=run.error_message))
    d.last_seen = now_kst()
    d.now_playing = None
    db.commit()
    retry = st == RUN_FAILED and run.attempt <= settings.BROADCAST_MAX_RETRY
    return ApiResponse(success=True, data={"ok": True, "retry_allowed": retry})
