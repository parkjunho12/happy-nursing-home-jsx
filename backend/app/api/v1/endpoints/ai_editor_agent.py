"""AI 페이지 편집기 — 에이전트 API.

에이전트가 서버에 붙는 방식은 방송 PC 와 같다.
  등록(한 번) → 토큰 → heartbeat · claim · report

왜 밀어넣기(push)가 아니라 가져가기(pull)인가:
편집 에이전트는 개발자 기계나 사내 서버에서 돈다. 밖에서 안으로 들어오는 길을
열지 않아도 되고, 잠시 꺼져 있어도 켜지면 밀린 작업을 이어서 가져간다.

인증: 등록코드로 한 번 받아 간 토큰. 원문은 저장하지 않고 sha256 만 둔다.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.ai_editor import (
    AiEditAgent, AiEditJob, AiEditService, AiEditEvent,
    ST_QUEUED, ST_RUNNING, ST_FAILED, ST_CANCELLED, DONE_STATUSES, now_kst,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _hash(token: str) -> str:
    return hashlib.sha256((token or "").encode()).hexdigest()


def _agent(x_agent_token: Optional[str] = Header(None, alias="X-Agent-Token"),
           db: Session = Depends(get_db)) -> AiEditAgent:
    if not x_agent_token:
        raise HTTPException(401, "에이전트 토큰이 없습니다.")
    a = (db.query(AiEditAgent)
           .filter(AiEditAgent.token_hash == _hash(x_agent_token),
                   AiEditAgent.active == True).first())      # noqa: E712
    if not a:
        raise HTTPException(401, "등록되지 않은 에이전트입니다.")
    a.last_seen = now_kst()
    return a


class RegisterBody(BaseModel):
    enroll_code: str
    agent_id: str
    name: Optional[str] = None
    hostname: Optional[str] = None
    version: Optional[str] = None
    tools: Optional[Dict[str, Any]] = None


@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    """등록 — 한 번만. 등록코드는 서버 .env 에 둔다."""
    code = getattr(settings, "AI_EDITOR_ENROLL_CODE", None) or ""
    if not code:
        raise HTTPException(503, "등록코드가 설정돼 있지 않습니다. 서버 .env 의 "
                                 "AI_EDITOR_ENROLL_CODE 를 설정하고 이미지를 다시 빌드해주세요.")
    # 한글·기호가 섞여도 안전하게 비교한다(compare_digest 는 바이트를 받는다)
    if not secrets.compare_digest(body.enroll_code.encode(), code.encode()):
        raise HTTPException(403, "등록코드가 올바르지 않습니다.")
    aid = (body.agent_id or "").strip()
    if not aid:
        raise HTTPException(400, "에이전트 식별자가 필요합니다.")

    a = db.query(AiEditAgent).filter(AiEditAgent.agent_id == aid).first()
    if not a:
        a = AiEditAgent(agent_id=aid)
        db.add(a)
    token = secrets.token_urlsafe(32)
    a.token_hash = _hash(token)
    a.name = (body.name or a.name or "편집 에이전트")[:100]
    a.hostname = body.hostname
    a.version = body.version
    a.tools = body.tools or {}
    a.active = True
    a.last_seen = now_kst()
    db.commit()
    return ApiResponse(success=True, data={"agent_token": token, "agent_id": aid},
                       message="등록되었습니다.")


@router.get("/services")
def agent_services(a: AiEditAgent = Depends(_agent), db: Session = Depends(get_db)):
    """편집 대상 목록.

    에이전트가 작업을 받기 전에도 이걸 알아야 한다 — 작업이 없을 때
    기준 브랜치로 미리보기를 띄워 두려면 dev_cmd 와 root_path 가 필요하다.
    claim 응답으로만 알 수 있으면, 첫 작업 전에는 아무것도 못 띄운다.
    """
    rows = (db.query(AiEditService)
              .filter(AiEditService.active == True)          # noqa: E712
              .order_by(AiEditService.sort, AiEditService.key).all())
    db.commit()   # _agent 가 찍은 last_seen 을 남긴다
    return ApiResponse(success=True, data={"services": [
        {"key": s.key, "name": s.name, "repo": s.repo, "root_path": s.root_path,
         "base_branch": s.base_branch, "install_cmd": s.install_cmd,
         "dev_cmd": s.dev_cmd, "check_cmds": s.check_cmds or [],
         "pages": s.pages or [], "prod_url": s.prod_url}
        for s in rows]})


# 에이전트가 아무 상태나 써넣지 못하게 한다
PREVIEW_STATES = {"off", "starting", "installing", "ready", "failed"}
PREVIEW_KINDS = {"base", "job"}


class HeartbeatBody(BaseModel):
    now_job_id: Optional[str] = None
    tools: Optional[Dict[str, Any]] = None
    # 지금 미리보기 자리에 무엇이 떠 있는지
    preview_kind: Optional[str] = None
    preview_service: Optional[str] = None
    preview_state: Optional[str] = None
    preview_url: Optional[str] = None
    preview_msg: Optional[str] = None


@router.post("/heartbeat")
def heartbeat(body: HeartbeatBody, a: AiEditAgent = Depends(_agent),
              db: Session = Depends(get_db)):
    a.now_job_id = body.now_job_id
    if body.tools:
        a.tools = body.tools

    # 미리보기 상태 — 화면의 안내 문구가 곧 이 값이다. 아무 값이나 들어오면
    # 화면이 거짓말을 하게 되므로 아는 값만 받는다.
    if body.preview_state is not None:
        if body.preview_state not in PREVIEW_STATES:
            raise HTTPException(400, "알 수 없는 미리보기 상태입니다.")
        a.preview_state = body.preview_state
    if body.preview_kind is not None:
        a.preview_kind = body.preview_kind if body.preview_kind in PREVIEW_KINDS else None
    for f in ("preview_service", "preview_url", "preview_msg"):
        v = getattr(body, f)
        if v is not None:
            setattr(a, f, v[:300] or None)

    want = a.want_service
    db.commit()

    # 중지 요청은 heartbeat 로 전한다 — 에이전트가 다음 단계 전에 확인한다
    cancel: List[str] = []
    if body.now_job_id:
        j = db.query(AiEditJob).filter(AiEditJob.id == body.now_job_id).first()
        if j and j.cancel_requested:
            cancel.append(j.id)
    # 화면이 '이 서비스를 보여줘' 라고 한 값을 함께 내려보낸다
    return ApiResponse(success=True, data={"cancel": cancel, "want_service": want})


@router.post("/claim")
def claim(a: AiEditAgent = Depends(_agent), db: Session = Depends(get_db)):
    """다음 작업 하나를 잡아간다.

    급한 것(priority 낮은 숫자) 먼저, 같으면 먼저 들어온 것부터.
    잡는 순간 RUNNING 으로 바꿔 다른 에이전트가 같은 것을 가져가지 못하게 한다.
    """
    j = (db.query(AiEditJob)
           .filter(AiEditJob.status == ST_QUEUED)
           .order_by(AiEditJob.priority, AiEditJob.created_at)
           .with_for_update(skip_locked=True)
           .first())
    if not j:
        db.commit()
        return ApiResponse(success=True, data=None)
    if j.cancel_requested:
        j.status, j.step, j.ended_at = ST_CANCELLED, "중지됨", now_kst()
        db.commit()
        return ApiResponse(success=True, data=None)

    svc = db.query(AiEditService).filter(AiEditService.key == j.service_key).first()
    if not svc or not svc.active:
        j.status = ST_FAILED
        j.error = "등록되지 않은 서비스입니다."
        j.ended_at = now_kst()
        db.add(AiEditEvent(job_id=j.id, level="error", message=j.error))
        db.commit()
        return ApiResponse(success=True, data=None)

    j.status = ST_RUNNING
    j.agent_id = a.agent_id
    j.started_at = j.started_at or now_kst()
    j.step = "에이전트가 시작했습니다"
    j.progress = 5
    a.now_job_id = j.id
    db.add(AiEditEvent(job_id=j.id, message=f"에이전트 {a.agent_id} 가 시작"))
    db.commit(); db.refresh(j)

    return ApiResponse(success=True, data={
        "job": {
            "id": j.id, "service_key": j.service_key, "page_url": j.page_url,
            "title": j.title, "instruction": j.instruction, "scope": j.scope,
            "extra_notes": j.extra_notes, "images": j.images or [],
            "target": j.target or {}, "approve_mode": j.approve_mode,
            "branch": j.branch, "head_sha": j.head_sha,
        },
        "service": {
            "key": svc.key, "repo": svc.repo, "root_path": svc.root_path,
            "base_branch": svc.base_branch, "install_cmd": svc.install_cmd,
            "dev_cmd": svc.dev_cmd, "check_cmds": svc.check_cmds or [],
            "prod_url": svc.prod_url,
        },
    })


class ReportBody(BaseModel):
    job_id: str
    status: Optional[str] = None
    step: Optional[str] = None
    progress: Optional[int] = None
    branch: Optional[str] = None
    base_sha: Optional[str] = None
    head_sha: Optional[str] = None
    worktree: Optional[str] = None
    plan: Optional[str] = None
    summary: Optional[str] = None
    diff: Optional[str] = None
    files: Optional[List[Dict[str, Any]]] = None
    checks: Optional[List[Dict[str, Any]]] = None
    preview_url: Optional[str] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    deploy_run: Optional[str] = None
    error: Optional[str] = None
    # 진행 로그 한 줄
    log: Optional[str] = None
    log_level: Optional[str] = None
    log_detail: Optional[str] = None


# 에이전트가 아무 상태나 써넣지 못하게 한다 — 화면의 진행 표시가 곧 신뢰다
ALLOWED_STATUS = {"RUNNING", "ANALYZING", "CHECKING", "PREVIEW",
                  "PR_OPEN", "MERGED", "DEPLOYED", "FAILED", "CANCELLED"}
# diff 는 통째로 받되 무한정은 아니다. 너무 크면 화면에서도 못 읽는다.
MAX_DIFF = 400_000


@router.post("/report")
def report(body: ReportBody, a: AiEditAgent = Depends(_agent),
           db: Session = Depends(get_db)):
    j = db.query(AiEditJob).filter(AiEditJob.id == body.job_id).first()
    if not j:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    if j.agent_id and j.agent_id != a.agent_id:
        raise HTTPException(409, "다른 에이전트가 맡은 작업입니다.")

    if body.status:
        if body.status not in ALLOWED_STATUS:
            raise HTTPException(400, "알 수 없는 상태입니다.")
        j.status = body.status
        if body.status in DONE_STATUSES or body.status in ("PREVIEW", "PR_OPEN"):
            j.ended_at = now_kst() if body.status in DONE_STATUSES else j.ended_at
    for f in ("step", "branch", "base_sha", "head_sha", "worktree", "plan",
              "summary", "files", "checks", "preview_url", "pr_url", "pr_number",
              "deploy_run", "error"):
        v = getattr(body, f)
        if v is not None:
            setattr(j, f, v)
    if body.progress is not None:
        j.progress = min(max(int(body.progress), 0), 100)
    if body.diff is not None:
        j.diff = body.diff[:MAX_DIFF]
    if body.log:
        db.add(AiEditEvent(job_id=j.id, level=(body.log_level or "info"),
                           message=body.log[:2000],
                           detail=(body.log_detail or "")[:20000] or None))
    j.updated_at = now_kst()
    db.commit()
    return ApiResponse(success=True, data={"cancel": bool(j.cancel_requested)})
