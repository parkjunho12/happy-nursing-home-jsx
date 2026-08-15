"""안내방송 — 예약·기기·실행기록.

구성: Admin에서 예약을 만들면 요양원 안의 Broadcast Agent(PC)가 내려받아
지정 시각에 재생한다. 오디오는 PC 출력 → BKH-180 LINE/AUX → 100V 실링스피커.

소방·비상방송 설비와는 완전히 분리된 '일반 안내방송'이다. 그쪽을 제어하지 않는다.

설계에서 중요한 두 가지
1) 반복 규칙 해석은 서버에만 둔다. Agent에는 '몇 시에 무엇을 틀지'만 내려준다.
   규칙이 두 곳에 있으면 언젠가 어긋난다.
2) 같은 방송이 두 번 나가면 안 된다. broadcast_runs 에
   (schedule_id, occurrence_at) UNIQUE 를 걸어 DB가 막는다.
   Agent가 여러 대여도, 재시작해도, 시계가 튀어도 한 번만 나간다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, JSON, UniqueConstraint, Index,
)

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 방송 종류
TYPE_TTS = "TTS"        # 문구를 읽어주는 방송
TYPE_AUDIO = "AUDIO"    # mp3 / wav 등 음원
TYPE_VIDEO = "VIDEO"    # mp4 — 오디오 트랙만 사용한다
BROADCAST_TYPES = (TYPE_TTS, TYPE_AUDIO, TYPE_VIDEO)

# 예약 상태
ST_DRAFT = "DRAFT"          # 만드는 중(미디어 준비 전)
ST_READY = "READY"          # 재생 가능
ST_FAILED = "FAILED"        # TTS 생성 실패 등
SCHEDULE_STATUSES = (ST_DRAFT, ST_READY, ST_FAILED)

# 실행 결과
RUN_PENDING = "PENDING"
RUN_PLAYING = "PLAYING"
RUN_SUCCESS = "SUCCESS"
RUN_FAILED = "FAILED"
RUN_SKIPPED = "SKIPPED"     # 지나간 회차·중지됨 등 — 실패와 구분한다

# 구역. 지금은 앰프에 Zone 컨트롤러가 없어 ALL 만 실제로 동작한다.
# 나중에 ZoneControllerAdapter 가 붙었을 때 데이터가 준비돼 있도록 구조만 먼저 둔다.
ZONE_ALL = "ALL"
KNOWN_ZONES = (ZONE_ALL, "2F", "3F", "4F")


class BroadcastDevice(Base):
    """방송을 트는 PC 한 대."""

    __tablename__ = "broadcast_devices"

    id          = Column(String, primary_key=True, default=_uuid)
    device_id   = Column(String(64), nullable=False, unique=True, index=True)   # 사람이 정하는 식별자
    facility_id = Column(String(64), nullable=False, default="default", index=True)
    name        = Column(String(100), nullable=False, default="방송 PC")
    # 토큰은 원문을 저장하지 않는다(sha256). 분실 시 재발급한다.
    token_hash  = Column(String(64), nullable=True, index=True)
    zones       = Column(JSON, nullable=True)        # 이 PC가 담당하는 구역 — 현재는 ["ALL"]
    output_name = Column(String(200), nullable=True) # 선택된 오디오 출력장치(참고용 표시)
    version     = Column(String(30), nullable=True)  # Agent 버전
    last_seen   = Column(DateTime(timezone=True), nullable=True, index=True)
    # 서버가 본 IP — Caddy 뒤라 X-Forwarded-For 를 봐야 진짜 값이 나온다.
    # 요양원 공유기의 WAN IP 라서 '어느 지점인지' 확인용이지, PC 를 찾는 용도는 아니다.
    last_ip     = Column(String(64), nullable=True)
    # PC 를 실제로 찾으려면 이 둘이 필요하다 — Agent 가 스스로 알려준다
    hostname    = Column(String(120), nullable=True)
    local_ip    = Column(String(64), nullable=True)   # 원내 網 주소 (192.168.x.x 등)
    # 지금 무엇을 틀고 있는지 — heartbeat 로 갱신
    now_playing = Column(String, nullable=True)
    active      = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), default=now_kst)
    updated_at  = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class BroadcastMedia(Base):
    """재생할 오디오 파일 한 개.

    TTS 결과물도, 업로드한 mp3/mp4도 모두 여기로 모은다.
    같은 문구의 TTS를 매번 다시 만들지 않도록 text_hash 로 재사용한다.
    """

    __tablename__ = "broadcast_media"

    id           = Column(String, primary_key=True, default=_uuid)
    kind         = Column(String(10), nullable=False, default=TYPE_AUDIO)  # TTS/AUDIO/VIDEO
    filename     = Column(String(255), nullable=False)      # uploads/broadcast/ 아래 파일명
    url          = Column(String(500), nullable=False)      # /uploads/broadcast/xxx
    mime         = Column(String(100), nullable=True)
    size_bytes   = Column(Integer, nullable=True)
    duration_sec = Column(Integer, nullable=True)           # 알 수 있으면 — 최대 방송시간 검증에 쓴다
    sha256       = Column(String(64), nullable=True, index=True)  # Agent 캐시 검증용
    # TTS 재사용 키 (provider|voice|speed|text 의 해시)
    text_hash    = Column(String(64), nullable=True, index=True)
    tts_provider = Column(String(40), nullable=True)
    tts_voice    = Column(String(40), nullable=True)
    created_by   = Column(String(100), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=now_kst)


class BroadcastSchedule(Base):
    """방송 예약 한 건."""

    __tablename__ = "broadcast_schedules"

    id           = Column(String, primary_key=True, default=_uuid)
    title        = Column(String(200), nullable=False)
    type         = Column(String(10), nullable=False, default=TYPE_TTS)
    text         = Column(Text, nullable=True)              # TTS 문구
    media_id     = Column(String, nullable=True, index=True)
    media_url    = Column(String(500), nullable=True)       # 편의용 사본(요구 스키마 유지)

    # 최초 실행 시각. 반복이면 이 시각의 '시:분'이 매 회차의 시각이 된다.
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    timezone     = Column(String(40), nullable=False, default="Asia/Seoul")
    # 반복 규칙: {"freq":"once|daily|weekdays|weekly", "days":[0..6], "until":"YYYY-MM-DD"}
    # 0=월 … 6=일 (파이썬 weekday 와 동일하게 둬서 변환 실수를 줄인다)
    repeat_rule  = Column(JSON, nullable=True)

    zones        = Column(JSON, nullable=False, default=lambda: [ZONE_ALL])
    volume       = Column(Integer, nullable=False, default=70)   # 0~100
    status       = Column(String(10), nullable=False, default=ST_DRAFT)
    enabled      = Column(Boolean, nullable=False, default=True)
    # 이 시간(초)을 넘기면 Agent가 강제로 끊는다. 무한 재생 사고 방지.
    max_seconds  = Column(Integer, nullable=False, default=600)
    error_message = Column(Text, nullable=True)

    created_by   = Column(String(100), nullable=True)
    created_by_id = Column(String, nullable=True, index=True)
    created_at   = Column(DateTime(timezone=True), default=now_kst)
    updated_at   = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class BroadcastRun(Base):
    """'몇 시 방송' 한 회차. 중복 재생을 막는 자물쇠이자 실행 기록이다.

    (schedule_id, occurrence_at) 이 유일하다 — Agent가 몇 대든, 몇 번 재시작하든
    한 회차는 한 번만 claim 된다.
    """

    __tablename__ = "broadcast_runs"
    __table_args__ = (
        UniqueConstraint("schedule_id", "occurrence_at", name="uq_broadcast_run_occurrence"),
        Index("ix_broadcast_runs_occ", "occurrence_at"),
    )

    id            = Column(String, primary_key=True, default=_uuid)
    schedule_id   = Column(String, nullable=False, index=True)
    occurrence_at = Column(DateTime(timezone=True), nullable=False)   # 이 회차의 예정 시각
    device_id     = Column(String(64), nullable=True, index=True)     # 잡아간 기기
    status        = Column(String(10), nullable=False, default=RUN_PENDING)
    attempt       = Column(Integer, nullable=False, default=0)        # 재시도 횟수
    claimed_at    = Column(DateTime(timezone=True), nullable=True)
    started_at    = Column(DateTime(timezone=True), nullable=True)
    ended_at      = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=now_kst)
    updated_at    = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class BroadcastLog(Base):
    """무슨 일이 있었는지 남기는 기록 — 실행 결과와 관리자 조작 모두."""

    __tablename__ = "broadcast_logs"

    id            = Column(String, primary_key=True, default=_uuid)
    schedule_id   = Column(String, nullable=True, index=True)
    run_id        = Column(String, nullable=True, index=True)
    device_id     = Column(String(64), nullable=True, index=True)
    event         = Column(String(30), nullable=False, default="PLAY")  # PLAY/STOP/EMERGENCY_STOP/CREATE/UPDATE/DELETE
    status        = Column(String(10), nullable=True)                   # SUCCESS/FAILED/SKIPPED
    title         = Column(String(200), nullable=True)                  # 예약이 지워져도 남게 제목을 복사
    started_at    = Column(DateTime(timezone=True), nullable=True)
    ended_at      = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    actor         = Column(String(100), nullable=True)                  # 사람이 한 조작이면 그 이름
    created_at    = Column(DateTime(timezone=True), default=now_kst, index=True)


class BroadcastCommand(Base):
    """Agent에게 지금 당장 시키는 일 — 즉시 중지 같은 것.

    Agent는 heartbeat 때 안 가져간 명령을 받아 처리하고 ack 한다.
    (즉시 방송은 예약을 '지금'으로 만들어 처리하므로 명령이 아니다)
    """

    __tablename__ = "broadcast_commands"

    id          = Column(String, primary_key=True, default=_uuid)
    device_id   = Column(String(64), nullable=True, index=True)   # None = 모든 기기
    command     = Column(String(30), nullable=False)              # STOP / EMERGENCY_STOP / RESYNC
    payload     = Column(JSON, nullable=True)
    issued_by   = Column(String(100), nullable=True)
    acked_at    = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=now_kst, index=True)
