"""AI 페이지 편집기 — 화면에서 고른 요소를 말로 고치고, 검증·PR·배포까지 잇는다.

구조를 이렇게 나눈 이유:

  Admin(브라우저) ─▶ 백엔드(작업 접수·상태 보관) ◀─ 편집 에이전트(실제 작업)

백엔드는 소스를 만지지 않는다. 작업을 받아 큐에 넣고 결과를 보관할 뿐이다.
실제 수정은 저장소·Claude CLI·node 가 있는 기계에서 도는 에이전트가 한다.
  · API 컨테이너에 git·셸·Claude CLI 를 넣지 않는다 — 웹에서 닿는 프로세스가
    소스와 배포 열쇠를 쥐면 사고 한 번이 곧 저장소 전체다
  · 방송 에이전트와 같은 방식(등록·토큰·폴링)이라 이미 검증된 길을 다시 쓴다

안전장치
  · 서비스 레지스트리에 올린 저장소·경로만 건드린다
  · 모든 수정은 전용 worktree 와 브랜치에서 한다. 공유 브랜치를 직접 고치지 않는다
  · 검증(타입·테스트·빌드)을 통과해야 PR 로 갈 수 있다
  · 배포는 기존 GitHub Actions 를 그대로 탄다 — 배포 경로를 새로 만들지 않는다
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, JSON, Index,
)

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 작업 상태 — 화면의 진행 표시와 그대로 맞춘다
ST_QUEUED = "QUEUED"          # 접수됨, 에이전트를 기다리는 중
ST_RUNNING = "RUNNING"        # 에이전트가 붙잡고 작업 중
ST_ANALYZING = "ANALYZING"    # 변경안만 뽑아보는 중(파일을 고치지 않는다)
ST_CHECKING = "CHECKING"      # 타입·테스트·빌드 검증 중
ST_PREVIEW = "PREVIEW"        # 검증 통과, 미리보기 떠 있음 — 사람 확인 대기
ST_PR_OPEN = "PR_OPEN"        # PR 열림
ST_MERGED = "MERGED"          # 병합됨 — 배포는 GitHub Actions 가 이어받는다
ST_DEPLOYED = "DEPLOYED"      # 운영 반영 확인됨
ST_FAILED = "FAILED"
ST_CANCELLED = "CANCELLED"

ACTIVE_STATUSES = (ST_QUEUED, ST_RUNNING, ST_ANALYZING, ST_CHECKING)
DONE_STATUSES = (ST_MERGED, ST_DEPLOYED, ST_FAILED, ST_CANCELLED)

# 수정 범위 — 에이전트에게 '어디까지 손대도 되는지' 를 알린다
SCOPE_ELEMENT = "element"     # 고른 요소만
SCOPE_PAGE = "page"           # 그 페이지 파일
SCOPE_FEATURE = "feature"     # 관련 기능(연결된 파일까지)
SCOPES = (SCOPE_ELEMENT, SCOPE_PAGE, SCOPE_FEATURE)

# 승인 방식
APPROVE_MANUAL = "manual"     # 사람이 보고 승인해야 PR·병합
APPROVE_AUTO = "auto"         # 검증을 통과하면 자동으로 PR·병합까지


class AiEditService(Base):
    """편집 대상 서비스 한 개 — 레지스트리.

    여기에 올린 것만 건드릴 수 있다. 저장소 주소나 경로를 화면에서 직접
    받지 않는 이유다 — 받으면 아무 저장소나 체크아웃시킬 수 있게 된다.
    """

    __tablename__ = "ai_edit_services"

    id           = Column(String, primary_key=True, default=_uuid)
    key          = Column(String(40), unique=True, nullable=False, index=True)  # 'admin'
    name         = Column(String(100), nullable=False)                # '관리자 화면'
    repo         = Column(String(200), nullable=False)                # 'owner/repo'
    # 저장소 안에서 이 서비스가 사는 자리. 에이전트는 이 밖을 고치지 않는다.
    root_path    = Column(String(200), nullable=False, default="apps/admin")
    base_branch  = Column(String(100), nullable=False, default="develop")
    # 배포 워크플로가 지켜보는 브랜치. 기준 브랜치와 다르면, 병합만으로는
    # 운영에 반영되지 않는다 — 여기로 한 번 더 올려야 한다.
    # 비워두면 '운영 반영' 을 쓰지 않는 서비스로 본다.
    deploy_branch = Column(String(100), nullable=True, default="main")
    # 미리보기를 띄우는 방법 — 서비스마다 다르다
    install_cmd  = Column(String(300), nullable=True)
    dev_cmd      = Column(String(300), nullable=True)   # 미리보기 서버
    check_cmds   = Column(JSON, nullable=True)          # ["pnpm ... tsc --noEmit", ...]
    # 화면에서 고를 수 있는 페이지들 [{path, label}]
    pages        = Column(JSON, nullable=True)
    prod_url     = Column(String(300), nullable=True)   # 운영 주소(참고용 — 여기서 편집하지 않는다)
    active       = Column(Boolean, nullable=False, default=True)
    sort         = Column(Integer, nullable=False, default=0)
    created_at   = Column(DateTime(timezone=True), default=now_kst)
    updated_at   = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class AiEditAgent(Base):
    """실제로 코드를 고치는 기계 한 대."""

    __tablename__ = "ai_edit_agents"

    id          = Column(String, primary_key=True, default=_uuid)
    agent_id    = Column(String(64), unique=True, nullable=False, index=True)
    name        = Column(String(100), nullable=False, default="편집 에이전트")
    token_hash  = Column(String(64), nullable=True, index=True)   # 원문은 저장하지 않는다
    hostname    = Column(String(120), nullable=True)
    version     = Column(String(30), nullable=True)
    # 이 기계가 실제로 할 수 있는 것 — 없는 도구를 있다고 하면 작업이 중간에 죽는다
    tools       = Column(JSON, nullable=True)      # {claude: "2.1.x", gh: "2.x", node: "20"}
    last_seen   = Column(DateTime(timezone=True), nullable=True, index=True)
    now_job_id  = Column(String, nullable=True)
    active      = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), default=now_kst)

    # ── 상시 미리보기 ────────────────────────────────────────────
    # 작업을 걸지 않아도 화면을 바로 볼 수 있어야 한다. 그래야 '무엇을
    # 고칠지' 를 보면서 정한다. 그래서 에이전트는 작업이 없을 때 기준
    # 브랜치로 미리보기 서버를 하나 띄워 둔다.
    #
    # 포트는 하나뿐이다(앞단이 그 포트만 바라본다). 그래서 작업 미리보기가
    # 뜰 때는 기본 미리보기가 자리를 비켜주고, 작업이 끝나면 돌아온다.
    # 아래 값들은 '지금 그 자리에 무엇이 떠 있는가' 를 화면에 알려준다.
    preview_kind    = Column(String(10), nullable=True)   # base | job
    preview_service = Column(String(40), nullable=True)
    preview_state   = Column(String(12), nullable=True)   # off|starting|installing|ready|failed
    preview_url     = Column(String(300), nullable=True)
    preview_msg     = Column(String(300), nullable=True)
    # 화면에서 '이 서비스를 보여줘' 라고 부탁한 값. 에이전트가 heartbeat 로
    # 받아 가서 그쪽으로 바꾼다.
    want_service    = Column(String(40), nullable=True)

    # 지금 운영에 반영되지 않은 것들. 에이전트가 5분마다 fetch 하면서 같이
    # 세어 알려준다. 버튼을 누르기 전에 '무엇이 함께 올라가는지' 를 보여주려면
    # 이게 있어야 한다 — 모르고 누르는 배포가 제일 위험하다.
    pending_deploy  = Column(JSON, nullable=True)   # {from,to,count,commits:[{sha,subject}]}


class AiEditJob(Base):
    """수정 요청 한 건 — 접수부터 배포까지의 한 줄기."""

    __tablename__ = "ai_edit_jobs"
    __table_args__ = (
        Index("ix_ai_edit_jobs_status_created", "status", "created_at"),
    )

    id          = Column(String, primary_key=True, default=_uuid)
    # 무슨 일을 하는 작업인가. 'edit' 은 코드를 고치는 보통 작업,
    # 'promote' 는 기준 브랜치를 배포 브랜치로 올리는 '운영 반영' 이다.
    # 큐·진행표시·기록을 그대로 쓰려고 같은 표에 담는다.
    kind        = Column(String(12), nullable=False, default="edit", index=True)
    service_key = Column(String(40), nullable=False, index=True)
    page_url    = Column(String(300), nullable=True)      # '/eval/residents'
    title       = Column(String(200), nullable=False)     # 목록에 보이는 한 줄

    # 사람이 적은 명령 — 그대로 보관한다. 나중에 '왜 이렇게 바뀌었나' 의 근거다
    instruction = Column(Text, nullable=False)
    scope       = Column(String(20), nullable=False, default=SCOPE_ELEMENT)
    priority    = Column(Integer, nullable=False, default=5)     # 1(급함) ~ 9
    approve_mode = Column(String(10), nullable=False, default=APPROVE_MANUAL)
    extra_notes = Column(Text, nullable=True)
    images      = Column(JSON, nullable=True)             # 첨부 이미지 주소들

    # 화면에서 고른 요소 — Inspector 가 보낸 그대로
    target      = Column(JSON, nullable=True)

    status      = Column(String(12), nullable=False, default=ST_QUEUED, index=True)
    step        = Column(String(120), nullable=True)      # '빌드 중' 처럼 지금 무엇을 하는지
    progress    = Column(Integer, nullable=False, default=0)   # 0~100

    branch      = Column(String(160), nullable=True)
    base_sha    = Column(String(40), nullable=True)
    head_sha    = Column(String(40), nullable=True)
    worktree    = Column(String(400), nullable=True)

    # 결과물
    plan        = Column(Text, nullable=True)             # 변경안(분석만 했을 때)
    summary     = Column(Text, nullable=True)             # 무엇을 왜 고쳤는지
    diff        = Column(Text, nullable=True)             # 통째 diff
    files       = Column(JSON, nullable=True)             # [{path, added, removed}]
    checks      = Column(JSON, nullable=True)             # [{name, ok, ms, output}]
    preview_url = Column(String(300), nullable=True)
    pr_url      = Column(String(300), nullable=True)
    pr_number   = Column(Integer, nullable=True)
    deploy_run  = Column(String(300), nullable=True)      # GitHub Actions 실행 주소
    error       = Column(Text, nullable=True)

    agent_id    = Column(String(64), nullable=True, index=True)
    requested_by = Column(String(100), nullable=True)
    requested_by_id = Column(String, nullable=True, index=True)
    # 사람이 중지를 눌렀는지 — 에이전트가 다음 단계 전에 확인하고 멈춘다
    cancel_requested = Column(Boolean, nullable=False, default=False)

    created_at  = Column(DateTime(timezone=True), default=now_kst, index=True)
    started_at  = Column(DateTime(timezone=True), nullable=True)
    ended_at    = Column(DateTime(timezone=True), nullable=True)
    updated_at  = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class AiEditEvent(Base):
    """작업 진행 기록 — 화면의 로그창에 그대로 흐른다.

    실패했을 때 '어디까지 갔다가 무엇 때문에 멈췄나' 를 남기지 않으면
    같은 실패를 반복한다.
    """

    __tablename__ = "ai_edit_events"
    __table_args__ = (
        Index("ix_ai_edit_events_job_at", "job_id", "created_at"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    job_id     = Column(String, nullable=False, index=True)
    level      = Column(String(10), nullable=False, default="info")   # info|warn|error
    message    = Column(Text, nullable=False)
    detail     = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
