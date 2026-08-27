"""AI 페이지 편집기 — 관리자 API.

권한: ADMIN 전용. 이 화면은 결국 저장소를 고치고 배포까지 가는 길이라,
직종으로 넓히지 않는다.

백엔드가 하는 일은 '접수하고 상태를 보관하는 것' 까지다.
소스를 만지는 일은 편집 에이전트(apps/ai-editor-agent)가 한다.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.ai_editor import (
    AiEditService, AiEditJob, AiEditEvent, AiEditAgent,
    ST_QUEUED, ST_RUNNING, ST_ANALYZING, ST_CHECKING, ST_PREVIEW,
    ST_PR_OPEN, ST_MERGED, ST_DEPLOYED, ST_FAILED, ST_CANCELLED,
    ACTIVE_STATUSES, DONE_STATUSES, SCOPES, SCOPE_ELEMENT,
    APPROVE_MANUAL, APPROVE_AUTO, now_kst,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _admin(current_user: User = Depends(get_current_user)) -> User:
    """ADMIN 전용 — 소스를 고치고 배포까지 가는 화면이다."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "AI 페이지 편집기는 ADMIN만 사용할 수 있습니다.")
    return current_user


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _svc_view(s: AiEditService) -> dict:
    return {
        "key": s.key, "name": s.name, "repo": s.repo, "root_path": s.root_path,
        "base_branch": s.base_branch, "pages": s.pages or [],
        "prod_url": s.prod_url, "active": bool(s.active),
        "check_cmds": s.check_cmds or [],
    }


def _job_view(j: AiEditJob, *, full: bool = False) -> dict:
    out = {
        "id": j.id, "service_key": j.service_key, "page_url": j.page_url,
        "title": j.title, "status": j.status, "step": j.step, "progress": j.progress,
        "scope": j.scope, "priority": j.priority, "approve_mode": j.approve_mode,
        "branch": j.branch, "preview_url": j.preview_url,
        "pr_url": j.pr_url, "pr_number": j.pr_number, "deploy_run": j.deploy_run,
        "files": j.files or [], "checks": j.checks or [],
        "error": j.error, "agent_id": j.agent_id,
        "requested_by": j.requested_by,
        "cancel_requested": bool(j.cancel_requested),
        "created_at": _iso(j.created_at), "started_at": _iso(j.started_at),
        "ended_at": _iso(j.ended_at),
    }
    if full:
        out.update({
            "instruction": j.instruction, "extra_notes": j.extra_notes,
            "images": j.images or [], "target": j.target,
            "plan": j.plan, "summary": j.summary, "diff": j.diff,
            "base_sha": j.base_sha, "head_sha": j.head_sha,
        })
    return out


def log_event(db: Session, job_id: str, message: str, *,
              level: str = "info", detail: Optional[str] = None) -> None:
    db.add(AiEditEvent(job_id=job_id, level=level, message=message[:2000],
                       detail=(detail or "")[:20000] or None))


# ──────────────────────────────────────────────────────────────
# 서비스 레지스트리
# ──────────────────────────────────────────────────────────────
@router.get("/services")
def list_services(db: Session = Depends(get_db), _: User = Depends(_admin)):
    rows = (db.query(AiEditService)
              .filter(AiEditService.active == True)          # noqa: E712
              .order_by(AiEditService.sort, AiEditService.key).all())
    agents = (db.query(AiEditAgent)
                .filter(AiEditAgent.active == True).all())   # noqa: E712
    now = now_kst()

    def alive(a: AiEditAgent) -> bool:
        if not a.last_seen:
            return False
        seen = a.last_seen if a.last_seen.tzinfo else a.last_seen.replace(tzinfo=now.tzinfo)
        return (now - seen) < timedelta(seconds=120)

    return ApiResponse(success=True, data={
        "services": [_svc_view(s) for s in rows],
        # 에이전트가 하나도 안 붙어 있으면 접수해도 아무 일이 일어나지 않는다.
        # 화면에서 미리 알려주려고 함께 내려보낸다.
        "agents": [{"agent_id": a.agent_id, "name": a.name, "hostname": a.hostname,
                    "version": a.version, "tools": a.tools or {},
                    "online": alive(a), "last_seen": _iso(a.last_seen),
                    "now_job_id": a.now_job_id} for a in agents],
        "online_agents": sum(1 for a in agents if alive(a)),
        # 지금 미리보기 자리에 무엇이 떠 있는지. 화면은 작업을 걸기 전에도
        # 이 주소로 화면을 보여준다.
        "preview": _preview_view(next((a for a in agents if alive(a)), None)),
    })


def _preview_view(a: Optional[AiEditAgent]) -> dict:
    """지금 볼 수 있는 미리보기 한 개.

    포트가 하나뿐이라 미리보기도 한 번에 하나다. 여러 대가 붙어 있어도
    화면에는 살아 있는 첫 대의 것만 보여준다 — 두 개를 보여주면 어느 쪽을
    보고 있는지 헷갈리고, 헷갈린 채로 고치면 엉뚱한 곳을 고친다.
    """
    if not a:
        return {"state": "off", "url": None, "kind": None,
                "service_key": None, "msg": "편집 에이전트가 꺼져 있습니다."}
    return {
        "state": a.preview_state or "off",
        "url": a.preview_url,
        "kind": a.preview_kind,
        "service_key": a.preview_service,
        "want_service": a.want_service,
        "msg": a.preview_msg,
        "agent_id": a.agent_id,
    }


class PreviewBody(BaseModel):
    service_key: str


@router.post("/preview")
def request_preview(body: PreviewBody, db: Session = Depends(get_db),
                    _: User = Depends(_admin)):
    """'이 서비스를 미리보기에 띄워줘' 라고 부탁한다.

    여기서 서버가 직접 띄우지 않는다. 부탁만 남기고, 에이전트가 heartbeat 로
    받아 가서 띄운다. 백엔드는 소스도 셸도 만지지 않는다는 선을 지킨다.

    레지스트리에 없는 키는 받지 않는다 — 받으면 화면에서 아무 문자열이나
    넣어 엉뚱한 것을 띄우게 할 수 있다.
    """
    svc = (db.query(AiEditService)
             .filter(AiEditService.key == body.service_key,
                     AiEditService.active == True).first())     # noqa: E712
    if not svc:
        raise HTTPException(404, "등록되지 않은 서비스입니다.")
    if not svc.dev_cmd:
        raise HTTPException(400, "이 서비스에는 미리보기 실행 명령(dev_cmd)이 없습니다.")

    now = now_kst()
    agents = db.query(AiEditAgent).filter(AiEditAgent.active == True).all()  # noqa: E712

    def alive(a: AiEditAgent) -> bool:
        if not a.last_seen:
            return False
        seen = a.last_seen if a.last_seen.tzinfo else a.last_seen.replace(tzinfo=now.tzinfo)
        return (now - seen) < timedelta(seconds=120)

    live = [a for a in agents if alive(a)]
    if not live:
        raise HTTPException(409, "편집 에이전트가 꺼져 있어 미리보기를 띄울 수 없습니다.")
    for a in live:
        a.want_service = svc.key
    db.commit()
    return ApiResponse(success=True, data=_preview_view(live[0]),
                       message="미리보기를 준비합니다.")


class ServiceBody(BaseModel):
    key: str
    name: str
    repo: str
    root_path: str = "apps/admin"
    base_branch: str = "develop"
    install_cmd: Optional[str] = None
    dev_cmd: Optional[str] = None
    check_cmds: Optional[List[str]] = None
    pages: Optional[List[Dict[str, Any]]] = None
    prod_url: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None


@router.put("/services/{key}")
def upsert_service(key: str, body: ServiceBody, db: Session = Depends(get_db),
                   _: User = Depends(_admin)):
    """레지스트리 등록·수정 — 여기에 올린 것만 편집기가 건드릴 수 있다."""
    s = db.query(AiEditService).filter(AiEditService.key == key).first()
    if not s:
        s = AiEditService(key=key)
        db.add(s)
    for f in ("name", "repo", "root_path", "base_branch", "install_cmd", "dev_cmd",
              "check_cmds", "pages", "prod_url", "active", "sort"):
        v = getattr(body, f)
        if v is not None:
            setattr(s, f, v)
    db.commit(); db.refresh(s)
    return ApiResponse(success=True, data=_svc_view(s))


# ──────────────────────────────────────────────────────────────
# 작업
# ──────────────────────────────────────────────────────────────
class JobBody(BaseModel):
    service_key: str
    page_url: Optional[str] = None
    instruction: str
    title: Optional[str] = None
    scope: str = SCOPE_ELEMENT
    priority: int = 5
    approve_mode: str = APPROVE_MANUAL
    extra_notes: Optional[str] = None
    images: Optional[List[str]] = None
    target: Optional[Dict[str, Any]] = None
    # 파일을 고치지 않고 '무엇을 어떻게 바꿀지' 만 받아본다
    analyze_only: bool = False


@router.post("/jobs")
def create_job(body: JobBody, db: Session = Depends(get_db),
               current_user: User = Depends(_admin)):
    text = (body.instruction or "").strip()
    if not text:
        raise HTTPException(400, "무엇을 고칠지 적어주세요.")
    if len(text) > 4000:
        raise HTTPException(400, "명령이 너무 깁니다. (최대 4000자)")
    svc = (db.query(AiEditService)
             .filter(AiEditService.key == body.service_key,
                     AiEditService.active == True).first())   # noqa: E712
    if not svc:
        raise HTTPException(404, "등록되지 않은 서비스입니다.")
    if body.scope not in SCOPES:
        raise HTTPException(400, "수정 범위가 올바르지 않습니다.")
    if body.approve_mode not in (APPROVE_MANUAL, APPROVE_AUTO):
        raise HTTPException(400, "승인 방식이 올바르지 않습니다.")

    # 같은 서비스에서 동시에 여러 건을 돌리면 worktree·미리보기 포트가 엉킨다.
    # 큐에 쌓이는 것은 괜찮지만, 몇 건까지인지는 눈에 보여야 한다.
    waiting = (db.query(AiEditJob)
                 .filter(AiEditJob.service_key == body.service_key,
                         AiEditJob.status.in_(ACTIVE_STATUSES)).count())
    if waiting >= 10:
        raise HTTPException(409, "대기 중인 작업이 너무 많습니다. 먼저 정리해주세요.")

    title = (body.title or text.strip().splitlines()[0])[:200]
    j = AiEditJob(
        service_key=body.service_key, page_url=body.page_url, title=title,
        instruction=text, scope=body.scope,
        priority=min(max(int(body.priority), 1), 9),
        approve_mode=body.approve_mode,
        extra_notes=(body.extra_notes or "").strip() or None,
        images=body.images or None, target=body.target or None,
        status=ST_QUEUED, step="접수됨 — 편집 에이전트를 기다리는 중",
        requested_by=getattr(current_user, "name", None),
        requested_by_id=getattr(current_user, "id", None),
    )
    # 분석만 하는 요청은 따로 표시해 둔다(에이전트가 파일을 고치지 않는다)
    if body.analyze_only:
        j.scope = body.scope
        j.step = "접수됨 — 변경안만 분석합니다"
        j.target = {**(j.target or {}), "_analyze_only": True}
    db.add(j); db.flush()
    log_event(db, j.id, "작업 접수", detail=text[:2000])
    db.commit(); db.refresh(j)
    return ApiResponse(success=True, data=_job_view(j, full=True),
                       message="접수했습니다. 편집 에이전트가 곧 시작합니다.")


@router.get("/jobs")
def list_jobs(service_key: Optional[str] = Query(None),
              status: Optional[str] = Query(None),
              limit: int = Query(30, le=100),
              db: Session = Depends(get_db), _: User = Depends(_admin)):
    q = db.query(AiEditJob)
    if service_key:
        q = q.filter(AiEditJob.service_key == service_key)
    if status == "active":
        q = q.filter(AiEditJob.status.in_(ACTIVE_STATUSES + (ST_PREVIEW, ST_PR_OPEN)))
    elif status:
        q = q.filter(AiEditJob.status == status)
    rows = q.order_by(AiEditJob.created_at.desc()).limit(limit).all()
    return ApiResponse(success=True, data=[_job_view(j) for j in rows])


@router.get("/jobs/{jid}")
def get_job(jid: str, since: Optional[str] = Query(None),
            db: Session = Depends(get_db), _: User = Depends(_admin)):
    j = db.query(AiEditJob).filter(AiEditJob.id == jid).first()
    if not j:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    eq = db.query(AiEditEvent).filter(AiEditEvent.job_id == jid)
    if since:
        eq = eq.filter(AiEditEvent.created_at > since)
    events = eq.order_by(AiEditEvent.created_at).limit(500).all()
    return ApiResponse(success=True, data={
        "job": _job_view(j, full=True),
        "events": [{"level": e.level, "message": e.message, "detail": e.detail,
                    "at": _iso(e.created_at)} for e in events],
    })


@router.post("/jobs/{jid}/cancel")
def cancel_job(jid: str, db: Session = Depends(get_db), current_user: User = Depends(_admin)):
    """중지 요청 — 에이전트가 다음 단계로 넘어가기 전에 확인하고 멈춘다.

    돌고 있는 명령을 강제로 죽이지 않는다. 반쯤 고쳐진 파일이 남는 것보다
    한 단계를 마치고 멈추는 편이 뒤처리가 깨끗하다.
    """
    j = db.query(AiEditJob).filter(AiEditJob.id == jid).first()
    if not j:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    if j.status in DONE_STATUSES:
        raise HTTPException(400, "이미 끝난 작업입니다.")
    j.cancel_requested = True
    if j.status == ST_QUEUED:            # 아직 아무도 안 잡았으면 바로 취소
        j.status, j.step, j.ended_at = ST_CANCELLED, "중지됨", now_kst()
    log_event(db, jid, f"중지 요청 — {getattr(current_user, 'name', '')}")
    db.commit(); db.refresh(j)
    return ApiResponse(success=True, data=_job_view(j))


class ApproveBody(BaseModel):
    merge: bool = False        # PR 만 만들지, 병합까지 갈지


@router.post("/jobs/{jid}/approve")
def approve_job(jid: str, body: ApproveBody, db: Session = Depends(get_db),
                current_user: User = Depends(_admin)):
    """사람이 미리보기를 보고 승인 — 에이전트가 PR(또는 병합)을 만든다."""
    j = db.query(AiEditJob).filter(AiEditJob.id == jid).first()
    if not j:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    if j.status not in (ST_PREVIEW, ST_PR_OPEN):
        raise HTTPException(400, "미리보기 확인이 끝난 작업만 승인할 수 있습니다.")
    if not (j.checks and all(c.get("ok") for c in j.checks)):
        raise HTTPException(400, "검증을 통과하지 못한 작업은 승인할 수 없습니다.")
    j.target = {**(j.target or {}),
                "_approved": True, "_merge": bool(body.merge),
                "_approved_by": getattr(current_user, "name", None)}
    j.step = "승인됨 — PR을 만드는 중" if not body.merge else "승인됨 — 병합하는 중"
    log_event(db, jid, f"승인 — {getattr(current_user, 'name', '')}"
                       + (" (병합까지)" if body.merge else " (PR만)"))
    db.commit(); db.refresh(j)
    return ApiResponse(success=True, data=_job_view(j))


class ReviseBody(BaseModel):
    instruction: str


@router.post("/jobs/{jid}/revise")
def revise_job(jid: str, body: ReviseBody, db: Session = Depends(get_db),
               current_user: User = Depends(_admin)):
    """수정 요청 — 같은 브랜치에서 이어서 고친다.

    새 작업으로 만들지 않는 이유: 브랜치를 새로 파면 앞서 고친 것이 사라진다.
    '조금 더 크게' 같은 다듬기는 한 줄기에서 이어져야 한다.
    """
    j = db.query(AiEditJob).filter(AiEditJob.id == jid).first()
    if not j:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    if j.status not in (ST_PREVIEW, ST_FAILED, ST_PR_OPEN):
        raise HTTPException(400, "미리보기·실패 상태에서만 수정 요청을 보낼 수 있습니다.")
    text = (body.instruction or "").strip()
    if not text:
        raise HTTPException(400, "무엇을 더 고칠지 적어주세요.")
    j.instruction = f"{j.instruction}\n\n[추가 요청]\n{text}"
    j.status, j.step, j.progress = ST_QUEUED, "수정 요청 — 다시 시작합니다", 0
    j.error = None
    j.cancel_requested = False
    j.ended_at = None
    log_event(db, jid, "수정 요청", detail=text[:2000])
    db.commit(); db.refresh(j)
    return ApiResponse(success=True, data=_job_view(j, full=True))


@router.post("/jobs/{jid}/rollback")
def rollback_job(jid: str, db: Session = Depends(get_db), current_user: User = Depends(_admin)):
    """되돌리기 — 병합된 변경을 되돌리는 PR을 만든다.

    이미 나간 커밋을 지우지 않는다. 되돌리는 것도 기록으로 남겨야
    '언제 왜 되돌렸나' 를 나중에 볼 수 있다.
    """
    j = db.query(AiEditJob).filter(AiEditJob.id == jid).first()
    if not j:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    if j.status not in (ST_MERGED, ST_DEPLOYED):
        raise HTTPException(400, "병합된 작업만 되돌릴 수 있습니다.")
    if not j.head_sha:
        raise HTTPException(400, "되돌릴 커밋을 알 수 없습니다.")
    j.target = {**(j.target or {}), "_rollback": True,
                "_rollback_by": getattr(current_user, "name", None)}
    j.status, j.step, j.progress = ST_QUEUED, "되돌리기 요청됨", 0
    log_event(db, jid, f"되돌리기 요청 — {getattr(current_user, 'name', '')}")
    db.commit(); db.refresh(j)
    return ApiResponse(success=True, data=_job_view(j))


# ──────────────────────────────────────────────────────────────
# 처음 한 번 — 이 저장소의 관리자 화면을 등록한다
# ──────────────────────────────────────────────────────────────
DEFAULT_SERVICE = {
    "key": "admin",
    "name": "관리자 화면 (apps/admin)",
    "repo": "parkjunho12/happy-nursing-home-jsx",
    "root_path": "apps/admin",
    "base_branch": "develop",
    "install_cmd": "npx --yes pnpm install --frozen-lockfile",
    # {port}·{host} 는 에이전트가 제 사정에 맞게 바꿔 넣는다.
    #   개발자 PC 라면 127.0.0.1, 컨테이너라면 0.0.0.0 이어야 한다 —
    #   컨테이너에서 loopback 에만 묶으면 앞단(Caddy)이 영영 닿지 못한다.
    # VITE_INSPECTOR=1 이어야 화면 요소에서 소스 위치를 읽을 수 있다.
    "dev_cmd": ("VITE_INSPECTOR=1 npx --yes pnpm --filter ./apps/admin exec "
                "vite --port {port} --host {host} --strictPort"),
    # 배포 워크플로가 돌리는 것과 같은 검사다 — 여기서 통과하면 CI 에서도 통과한다
    "check_cmds": [
        "npx --yes pnpm --filter ./apps/admin exec tsc --noEmit",
        "npx --yes pnpm --filter ./apps/admin test",
        "npx --yes pnpm --filter ./apps/admin exec vite build",
    ],
    "prod_url": "https://admin.xn--p80bu1t60gba47bg6abm347gsla.com",
    "pages": [
        {"path": "/", "label": "대시보드"},
        {"path": "/eval/residents", "label": "수급자 관리"},
        {"path": "/resident-docs", "label": "어르신 서류현황"},
        {"path": "/work-schedule", "label": "근무 편성표"},
        {"path": "/programs", "label": "프로그램 관리"},
        {"path": "/broadcast", "label": "방송 관리"},
        {"path": "/monthly-routines", "label": "월간 업무"},
        {"path": "/operations", "label": "운영·계약"},
        {"path": "/schedule", "label": "일정 캘린더"},
        {"path": "/assignments", "label": "담당 어르신 명단"},
    ],
}


@router.post("/services/seed")
def seed_service(db: Session = Depends(get_db), _: User = Depends(_admin)):
    """이 저장소의 관리자 화면을 기본값으로 등록한다.

    손으로 JSON 을 적게 하면 오타 하나에 엉뚱한 저장소를 체크아웃하게 된다.
    이미 있으면 건드리지 않는다 — 고쳐 둔 설정을 덮어쓰지 않는다.
    """
    if db.query(AiEditService).filter(AiEditService.key == DEFAULT_SERVICE["key"]).first():
        raise HTTPException(400, "이미 등록되어 있습니다.")
    db.add(AiEditService(**DEFAULT_SERVICE))
    db.commit()
    return ApiResponse(success=True, data=DEFAULT_SERVICE,
                       message="관리자 화면을 등록했습니다.")
