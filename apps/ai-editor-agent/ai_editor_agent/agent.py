"""AI 페이지 편집기 — 편집 에이전트.

Admin 에서 접수한 수정 요청을 실제로 수행한다.
저장소·Claude CLI·node 가 있는 기계에서 돈다(개발자 PC 또는 사내 서버).

한 건의 흐름
  1) claim        — 서버에서 작업 하나를 가져온다
  2) worktree     — 전용 worktree + 브랜치를 만든다 (공유 브랜치는 건드리지 않는다)
  3) claude       — Claude CLI 에게 고치라고 시킨다
  4) checks       — 타입·테스트·빌드를 돌린다
  5) preview      — 미리보기 서버를 띄운다
  6) 사람 승인    — PREVIEW 상태로 두고 기다린다
  7) PR / merge   — 승인되면 PR 을 만들고(또는 병합하고) 끝낸다

지켜야 하는 것
  · git reset --hard, stash, 공유 브랜치 직접 수정 — 하지 않는다
  · 원본 작업 폴더(사람이 쓰는 곳)에서 체크아웃을 바꾸지 않는다.
    worktree 는 별도 폴더에 만든다
  · 서비스 레지스트리에 적힌 root_path 밖은 고치지 않는다
  · 중지 요청이 오면 다음 단계로 넘어가기 전에 멈춘다
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("ai-editor-agent")
KST = timezone(timedelta(hours=9))

# 미리보기 서버가 쓸 포트 범위 — 여러 건이 동시에 떠도 안 겹치게
PREVIEW_PORT_FROM = 4310
PREVIEW_PORT_TO = 4349

# 한 단계가 이보다 오래 걸리면 뭔가 잘못된 것이다
CLAUDE_TIMEOUT = 900
CHECK_TIMEOUT = 900
GIT_TIMEOUT = 180


class AgentError(Exception):
    pass


class Cancelled(Exception):
    """사람이 중지를 눌렀다 — 조용히 접는다."""


def now_kst() -> datetime:
    return datetime.now(KST)


def run(cmd: List[str] | str, *, cwd: Optional[str] = None, timeout: int = 120,
        env: Optional[dict] = None, shell: bool = False) -> Tuple[int, str, str]:
    """명령 하나 실행. (종료코드, 표준출력, 표준오류)

    실패해도 예외를 던지지 않는다 — 부르는 쪽이 무엇을 할지 정한다.
    """
    e = {**os.environ, **(env or {})}
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, env=e, shell=shell)
        return p.returncode, p.stdout or "", p.stderr or ""
    except subprocess.TimeoutExpired:
        return 124, "", f"시간 초과 ({timeout}초)"
    except FileNotFoundError as ex:
        return 127, "", str(ex)


# ── 서버와 주고받기 ───────────────────────────────────────────────

class ApiClient:
    def __init__(self, base: str, token: Optional[str] = None):
        self.base = base.rstrip("/")
        self.token = token

    def _req(self, method: str, path: str, body: Optional[dict] = None,
             timeout: int = 60) -> dict:
        url = f"{self.base}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("X-Agent-Token", self.token)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                payload = json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as ex:
            detail = ex.read().decode()[:300]
            raise AgentError(f"HTTP {ex.code} {detail}") from ex
        except Exception as ex:
            raise AgentError(str(ex)) from ex
        if not payload.get("success"):
            raise AgentError(payload.get("message") or payload.get("error") or "실패")
        return payload.get("data") or {}

    def register(self, code: str, agent_id: str, name: str,
                 tools: dict) -> str:
        d = self._req("POST", "/api/v1/ai-editor-agent/register", {
            "enroll_code": code, "agent_id": agent_id, "name": name,
            "hostname": socket.gethostname(), "version": AGENT_VERSION,
            "tools": tools})
        return d["agent_token"]

    def heartbeat(self, now_job_id: Optional[str], tools: dict) -> dict:
        return self._req("POST", "/api/v1/ai-editor-agent/heartbeat",
                         {"now_job_id": now_job_id, "tools": tools})

    def claim(self) -> Optional[dict]:
        d = self._req("POST", "/api/v1/ai-editor-agent/claim", {})
        return d or None

    def report(self, **kw) -> dict:
        return self._req("POST", "/api/v1/ai-editor-agent/report", kw, timeout=120)


AGENT_VERSION = "1.0.0"


# ── 도구 확인 ────────────────────────────────────────────────────

def detect_tools() -> Dict[str, Any]:
    """이 기계가 실제로 무엇을 할 수 있는지.

    없는 도구를 있다고 하면 작업이 중간에 죽는다. 미리 재서 서버에 알린다.
    """
    out: Dict[str, Any] = {}
    for name, cmd in (("claude", ["claude", "--version"]),
                      ("gh", ["gh", "--version"]),
                      ("git", ["git", "--version"]),
                      ("node", ["node", "--version"])):
        code, so, _ = run(cmd, timeout=20)
        out[name] = so.strip().splitlines()[0] if code == 0 and so.strip() else None
    # pnpm 은 PATH 에 없어도 corepack 으로 쓸 수 있다
    code, so, _ = run(["pnpm", "--version"], timeout=20)
    if code == 0:
        out["pnpm"] = so.strip()
    else:
        code, so, _ = run(["npx", "--yes", "pnpm", "--version"], timeout=90)
        out["pnpm"] = f"npx {so.strip()}" if code == 0 else None
    # gh 로그인 여부 — PR 을 만들 수 있는지가 여기서 갈린다
    code, _, _ = run(["gh", "auth", "status"], timeout=20)
    out["gh_auth"] = code == 0
    return out


def free_port() -> int:
    for p in range(PREVIEW_PORT_FROM, PREVIEW_PORT_TO + 1):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    raise AgentError("미리보기에 쓸 포트가 남아 있지 않습니다.")


# ── 본체 ─────────────────────────────────────────────────────────

@dataclass
class Config:
    server_url: str
    repo_dir: str                       # 사람이 쓰는 원본 작업 폴더(여기서 worktree 를 판다)
    work_dir: str                       # worktree 를 만들 자리
    agent_id: str = "editor-1"
    name: str = "편집 에이전트"
    agent_token: Optional[str] = None
    poll_sec: int = 5
    heartbeat_sec: int = 20
    preview_host: str = "127.0.0.1"
    # 미리보기 주소를 밖에서 열어야 하면 여기에 공개 주소를 적는다
    preview_base: Optional[str] = None
    # 정해진 포트 하나만 쓴다(서버). 앞단(Caddy)이 이 포트만 바라보면 되고,
    # 한 번에 한 건만 도는 구조라 포트를 여러 개 열 이유가 없다.
    # 0 이면 비어 있는 포트를 그때그때 고른다(개발자 PC).
    preview_port: int = 0
    keep_worktrees: int = 5             # 최근 몇 개까지 남겨둘지


class EditorAgent:
    def __init__(self, cfg: Config, api: Optional[ApiClient] = None):
        self.cfg = cfg
        self.api = api or ApiClient(cfg.server_url, cfg.agent_token)
        self.tools = detect_tools()
        self.job: Optional[dict] = None
        self.svc: Optional[dict] = None
        self._stop = threading.Event()
        self._previews: Dict[str, subprocess.Popen] = {}

    # ── 보고 ──
    def say(self, msg: str, *, level: str = "info", detail: Optional[str] = None,
            **fields) -> None:
        if not self.job:
            return
        try:
            r = self.api.report(job_id=self.job["id"], log=msg, log_level=level,
                                log_detail=detail, **fields)
            if r.get("cancel"):
                raise Cancelled()
        except Cancelled:
            raise
        except AgentError as e:
            logger.warning("보고 실패(계속 진행): %s", e)

    def check_cancel(self) -> None:
        """다음 단계로 넘어가기 전에 확인한다."""
        if not self.job:
            return
        try:
            r = self.api.report(job_id=self.job["id"])
            if r.get("cancel"):
                raise Cancelled()
        except AgentError:
            pass

    # ── 1. worktree ──
    def make_worktree(self, job: dict, svc: dict) -> Tuple[str, str]:
        """전용 worktree 와 브랜치.

        사람이 쓰는 폴더의 체크아웃을 바꾸지 않는다 — git worktree 로 별도
        폴더를 파고, 거기서만 일한다.
        """
        repo = self.cfg.repo_dir
        base = svc["base_branch"]
        short = job["id"][:8]
        branch = job.get("branch") or f"ai/{job['service_key']}-{short}"
        wt = os.path.join(self.cfg.work_dir, f"{job['service_key']}-{short}")

        # 이미 있으면 이어서 쓴다(수정 요청으로 다시 온 경우)
        if os.path.isdir(os.path.join(wt, ".git")) or os.path.isfile(os.path.join(wt, ".git")):
            self.say("기존 작업 폴더를 이어서 씁니다", detail=wt)
            return wt, branch

        os.makedirs(self.cfg.work_dir, exist_ok=True)
        self.say(f"최신 {base} 를 가져옵니다")
        code, _, err = run(["git", "fetch", "origin", base], cwd=repo, timeout=GIT_TIMEOUT)
        if code != 0:
            raise AgentError(f"fetch 실패: {err[:300]}")

        code, so, err = run(["git", "worktree", "add", "-b", branch, wt,
                             f"origin/{base}"], cwd=repo, timeout=GIT_TIMEOUT)
        if code != 0:
            # 브랜치가 이미 있으면 그것을 그대로 붙인다
            code2, _, err2 = run(["git", "worktree", "add", wt, branch],
                                 cwd=repo, timeout=GIT_TIMEOUT)
            if code2 != 0:
                raise AgentError(f"작업 폴더를 만들지 못했습니다: {err[:200]} / {err2[:200]}")
        self.say(f"작업 폴더 준비 — {branch}", detail=wt)
        return wt, branch

    # ── 2. Claude ──
    def build_prompt(self, job: dict, svc: dict, *, analyze_only: bool) -> str:
        t = job.get("target") or {}
        lines: List[str] = []
        lines.append("너는 이 저장소를 고치는 개발자다. 아래 요청대로 코드를 고쳐라.")
        lines.append("")
        lines.append(f"## 서비스\n{svc['key']} — 이 서비스의 소스는 `{svc['root_path']}` 아래에 있다.")
        lines.append(f"**`{svc['root_path']}` 밖의 파일은 고치지 마라.**")
        if job.get("page_url"):
            lines.append(f"\n## 화면\n{job['page_url']}")
        if t.get("sourceFile"):
            loc = f"{t['sourceFile']}"
            if t.get("line"):
                loc += f":{t['line']}"
                if t.get("column"):
                    loc += f":{t['column']}"
            lines.append(f"\n## 고칠 자리\n{loc}")
            if t.get("componentName"):
                lines.append(f"컴포넌트: {t['componentName']}")
            if t.get("componentPath"):
                lines.append(f"경로: {' > '.join(t['componentPath'])}")
            if t.get("text"):
                lines.append(f"화면에 보이는 글자: {t['text']!r}")
            if t.get("selector"):
                lines.append(f"선택자: {t['selector']}")

        scope_help = {
            "element": "고른 요소만 고쳐라. 다른 요소·다른 화면은 건드리지 마라.",
            "page": "이 화면 파일 안에서 고쳐라. 다른 화면은 건드리지 마라.",
            "feature": "이 기능에 연결된 파일까지 고쳐도 된다. 다만 최소한으로.",
        }
        lines.append(f"\n## 수정 범위\n{scope_help.get(job.get('scope'), scope_help['element'])}")
        lines.append(f"\n## 요청\n{job['instruction']}")
        if job.get("extra_notes"):
            lines.append(f"\n## 추가 요구사항\n{job['extra_notes']}")

        lines.append("""
## 지켜야 할 것
- 이 저장소의 주변 코드와 같은 결로 쓴다(들여쓰기·이름·주석 밀도).
- 주석은 한국어로, '무엇을' 이 아니라 '왜' 를 적는다.
- 타입 오류가 나지 않게 한다. 이 저장소는 빌드 전에 tsc 를 돌린다.
- 요청에 없는 것을 덤으로 고치지 마라.
- 파일을 새로 만들기보다 있는 파일을 고치는 쪽을 먼저 생각한다.
""")
        if analyze_only:
            lines.append("""
## 이번에는 파일을 고치지 마라
무엇을 어떻게 바꿀지만 한국어로 설명해라. 다음을 포함한다.
1. 고칠 파일과 위치
2. 어떻게 바꿀지
3. 그렇게 하면 다른 곳에 어떤 영향이 있는지
4. 걱정되는 점
파일은 절대 수정하지 마라.
""")
        else:
            lines.append("""
## 끝내고 나서
마지막에 아래 형식으로 요약을 한 번만 출력해라.
<<<SUMMARY
- 무엇을 고쳤는지 (한 줄씩)
- 왜 그렇게 했는지
SUMMARY>>>
""")
        return "\n".join(lines)

    def run_claude(self, wt: str, prompt: str, *, analyze_only: bool) -> str:
        """Claude CLI 로 코드를 고친다.

        -p 는 한 번 물어보고 끝내는 방식이다(대화창을 띄우지 않는다).
        분석만 할 때는 파일을 못 고치게 도구를 읽기 전용으로 묶는다.
        """
        cmd = ["claude", "-p", prompt, "--permission-mode",
               "plan" if analyze_only else "acceptEdits"]
        if analyze_only:
            cmd += ["--allowed-tools", "Read,Grep,Glob"]
        self.say("Claude 가 코드를 보는 중입니다" if analyze_only else "Claude 가 코드를 고치는 중입니다",
                 progress=35, step="Claude 작업 중")
        code, so, se = run(cmd, cwd=wt, timeout=CLAUDE_TIMEOUT)
        if code != 0:
            raise AgentError(f"Claude 실행 실패 (코드 {code}): {(se or so)[-800:]}")
        return so

    # ── 3. 검증 ──
    def run_checks(self, wt: str, svc: dict) -> List[dict]:
        cmds: List[str] = svc.get("check_cmds") or []
        if not cmds:
            return []
        results: List[dict] = []
        for i, c in enumerate(cmds, 1):
            self.check_cancel()
            self.say(f"검증 {i}/{len(cmds)} — {c}", step=f"검증 {i}/{len(cmds)}",
                     progress=55 + int(25 * i / max(len(cmds), 1)))
            t0 = time.time()
            code, so, se = run(c, cwd=wt, timeout=CHECK_TIMEOUT, shell=True)
            ms = int((time.time() - t0) * 1000)
            tail = (se or so or "")[-4000:]
            results.append({"name": c, "ok": code == 0, "ms": ms, "output": tail})
            if code != 0:
                self.say(f"검증 실패 — {c}", level="error", detail=tail)
                break
            self.say(f"검증 통과 — {c} ({ms}ms)")
        return results

    # ── 4. 미리보기 ──
    def start_preview(self, job_id: str, wt: str, svc: dict) -> Optional[str]:
        dev = svc.get("dev_cmd")
        if not dev:
            return None
        self.stop_preview(job_id)
        port = self.cfg.preview_port or free_port()
        if self.cfg.preview_port:
            for _ in range(15):
                with socket.socket() as s:
                    if s.connect_ex(("127.0.0.1", port)) != 0:
                        break
                time.sleep(1)
        cmd = dev.replace("{port}", str(port))
        self.say(f"미리보기를 띄웁니다 (포트 {port})", step="미리보기 준비", progress=85)
        p = subprocess.Popen(cmd, cwd=wt, shell=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             start_new_session=True)
        self._previews[job_id] = p
        # 뜰 때까지 잠깐 기다린다 — 바로 열면 빈 화면이 뜬다
        page = (self.job or {}).get("page_url") or ""
        probe_host = "127.0.0.1" if self.cfg.preview_host in ("0.0.0.0", "") else self.cfg.preview_host
        for _ in range(90):
            time.sleep(1)
            with socket.socket() as s:
                if s.connect_ex((probe_host, port)) == 0:
                    base = self.cfg.preview_base or f"http://{probe_host}:{port}"
                    return base.rstrip("/") + page
            if p.poll() is not None:
                self.say("미리보기 서버가 바로 꺼졌습니다", level="warn")
                return None
        self.say("미리보기가 시간 안에 뜨지 않았습니다", level="warn")
        return None

    def stop_preview(self, job_id: str) -> None:
        p = self._previews.pop(job_id, None)
        if not p:
            return
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except Exception:
            try:
                p.terminate()
            except Exception:
                pass

    # ── 5. 커밋 · PR ──
    def commit(self, wt: str, job: dict) -> Optional[str]:
        code, so, _ = run(["git", "status", "--porcelain"], cwd=wt, timeout=GIT_TIMEOUT)
        if not so.strip():
            return None
        run(["git", "add", "-A"], cwd=wt, timeout=GIT_TIMEOUT)
        msg = (f"#patch {job['title'][:120]}\n\n"
               f"AI 페이지 편집기로 수정.\n요청: {job['instruction'][:1500]}\n\n"
               f"요청자: {job.get('requested_by') or '-'}\n작업: {job['id']}")
        code, _, err = run(["git", "commit", "-m", msg], cwd=wt, timeout=GIT_TIMEOUT)
        if code != 0:
            raise AgentError(f"커밋 실패: {err[:300]}")
        _, sha, _ = run(["git", "rev-parse", "HEAD"], cwd=wt, timeout=GIT_TIMEOUT)
        return sha.strip()

    def diff_of(self, wt: str, base: str) -> Tuple[str, List[dict]]:
        _, diff, _ = run(["git", "diff", f"origin/{base}...HEAD"], cwd=wt, timeout=GIT_TIMEOUT)
        _, stat, _ = run(["git", "diff", "--numstat", f"origin/{base}...HEAD"],
                         cwd=wt, timeout=GIT_TIMEOUT)
        files = []
        for ln in stat.strip().splitlines():
            parts = ln.split("\t")
            if len(parts) == 3:
                files.append({"path": parts[2],
                              "added": int(parts[0]) if parts[0].isdigit() else 0,
                              "removed": int(parts[1]) if parts[1].isdigit() else 0})
        return diff, files

    def open_pr(self, wt: str, job: dict, svc: dict, *, merge: bool) -> dict:
        if not self.tools.get("gh_auth"):
            raise AgentError("gh 로그인이 되어 있지 않아 PR을 만들 수 없습니다. "
                             "이 기계에서 `gh auth login` 을 먼저 해주세요.")
        branch = job["branch"]
        self.say("변경을 올립니다", step="PR 준비", progress=90)
        code, _, err = run(["git", "push", "-u", "origin", branch], cwd=wt, timeout=GIT_TIMEOUT)
        if code != 0:
            raise AgentError(f"push 실패: {err[:300]}")
        body = (f"AI 페이지 편집기로 만든 변경입니다.\n\n"
                f"**요청**\n> {job['instruction'][:1500]}\n\n"
                f"**요청자** {job.get('requested_by') or '-'}\n"
                f"**화면** {job.get('page_url') or '-'}\n"
                f"**작업 번호** `{job['id']}`\n")
        code, so, err = run(["gh", "pr", "create", "--base", svc["base_branch"],
                             "--head", branch, "--title", f"[AI] {job['title'][:100]}",
                             "--body", body], cwd=wt, timeout=GIT_TIMEOUT)
        url = ""
        if code == 0:
            url = (so or "").strip().splitlines()[-1] if so.strip() else ""
        else:
            # 이미 열려 있으면 그것을 쓴다
            code2, so2, _ = run(["gh", "pr", "view", "--json", "url", "-q", ".url"],
                                cwd=wt, timeout=GIT_TIMEOUT)
            if code2 != 0:
                raise AgentError(f"PR 생성 실패: {err[:300]}")
            url = so2.strip()
        num = None
        m = re.search(r"/pull/(\d+)", url)
        if m:
            num = int(m.group(1))
        self.say(f"PR 생성 — {url}", detail=url)

        if merge:
            self.say("병합합니다", step="병합 중", progress=95)
            code, _, err = run(["gh", "pr", "merge", "--squash", "--delete-branch"],
                               cwd=wt, timeout=GIT_TIMEOUT)
            if code != 0:
                self.say(f"병합 실패 — PR 은 열려 있습니다: {err[:200]}", level="warn")
                return {"pr_url": url, "pr_number": num, "merged": False}
            return {"pr_url": url, "pr_number": num, "merged": True}
        return {"pr_url": url, "pr_number": num, "merged": False}

    # ── 되돌리기 ──
    def do_rollback(self, job: dict, svc: dict) -> dict:
        if not job.get("head_sha"):
            raise AgentError("되돌릴 커밋을 알 수 없습니다.")
        repo = self.cfg.repo_dir
        short = job["id"][:8]
        branch = f"revert/{job['service_key']}-{short}"
        wt = os.path.join(self.cfg.work_dir, f"revert-{short}")
        run(["git", "fetch", "origin", svc["base_branch"]], cwd=repo, timeout=GIT_TIMEOUT)
        if not os.path.exists(wt):
            code, _, err = run(["git", "worktree", "add", "-b", branch, wt,
                                f"origin/{svc['base_branch']}"], cwd=repo, timeout=GIT_TIMEOUT)
            if code != 0:
                raise AgentError(f"되돌리기 폴더 생성 실패: {err[:300]}")
        code, _, err = run(["git", "revert", "--no-edit", "-m", "1", job["head_sha"]],
                           cwd=wt, timeout=GIT_TIMEOUT)
        if code != 0:
            code, _, err2 = run(["git", "revert", "--no-edit", job["head_sha"]],
                                cwd=wt, timeout=GIT_TIMEOUT)
            if code != 0:
                raise AgentError(f"되돌리기 실패: {err[:200]} / {err2[:200]}")
        job2 = {**job, "branch": branch, "title": f"되돌리기 — {job['title'][:80]}"}
        return self.open_pr(wt, job2, svc, merge=False)

    # ── 한 건 처리 ──
    def handle(self, payload: dict) -> None:
        job, svc = payload["job"], payload["service"]
        self.job, self.svc = job, svc
        t = job.get("target") or {}
        analyze_only = bool(t.get("_analyze_only"))
        approved = bool(t.get("_approved"))
        rollback = bool(t.get("_rollback"))

        try:
            if rollback:
                self.say("되돌리기를 시작합니다", status="RUNNING", step="되돌리는 중", progress=20)
                r = self.do_rollback(job, svc)
                self.api.report(job_id=job["id"], status="PR_OPEN",
                                step="되돌리기 PR 생성됨", progress=100,
                                pr_url=r["pr_url"], pr_number=r["pr_number"],
                                log="되돌리기 PR 을 만들었습니다")
                return

            # 승인 뒤 다시 들어온 경우 — 고치는 단계는 건너뛰고 PR 로 간다
            if approved and job.get("branch"):
                wt = os.path.join(self.cfg.work_dir,
                                  f"{job['service_key']}-{job['id'][:8]}")
                if not os.path.isdir(wt):
                    raise AgentError("작업 폴더가 사라졌습니다. 수정 요청으로 다시 만들어주세요.")
                r = self.open_pr(wt, job, svc, merge=bool(t.get("_merge")))
                self.api.report(
                    job_id=job["id"],
                    status="MERGED" if r["merged"] else "PR_OPEN",
                    step="병합됨 — 배포는 GitHub Actions 가 이어받습니다" if r["merged"]
                         else "PR 생성됨 — 검토를 기다립니다",
                    progress=100, pr_url=r["pr_url"], pr_number=r["pr_number"],
                    log="병합했습니다" if r["merged"] else "PR 을 만들었습니다")
                if r["merged"]:
                    self.stop_preview(job["id"])
                return

            self.check_cancel()
            wt, branch = self.make_worktree(job, svc)
            _, base_sha, _ = run(["git", "rev-parse", f"origin/{svc['base_branch']}"],
                                 cwd=wt, timeout=GIT_TIMEOUT)
            self.api.report(job_id=job["id"], branch=branch, worktree=wt,
                            base_sha=base_sha.strip(), step="작업 폴더 준비됨", progress=15)

            # 의존성 — 없으면 타입체크·빌드가 돌지 않는다
            if svc.get("install_cmd") and not os.path.isdir(os.path.join(wt, "node_modules")):
                self.check_cancel()
                self.say("의존성을 설치합니다 (처음 한 번은 오래 걸립니다)",
                         step="의존성 설치", progress=20)
                code, _, err = run(svc["install_cmd"], cwd=wt, timeout=1800, shell=True)
                if code != 0:
                    raise AgentError(f"의존성 설치 실패: {err[-600:]}")

            self.check_cancel()
            prompt = self.build_prompt(job, svc, analyze_only=analyze_only)
            if analyze_only:
                self.api.report(job_id=job["id"], status="ANALYZING", step="변경안 분석 중",
                                progress=30)
            out = self.run_claude(wt, prompt, analyze_only=analyze_only)

            if analyze_only:
                self.api.report(job_id=job["id"], status="PREVIEW", step="변경안이 나왔습니다",
                                progress=100, plan=out[-20000:],
                                log="변경안 분석을 마쳤습니다")
                return

            self.check_cancel()
            summary = ""
            m = re.search(r"<<<SUMMARY(.*?)SUMMARY>>>", out, re.S)
            if m:
                summary = m.group(1).strip()

            sha = self.commit(wt, job)
            if not sha:
                self.api.report(job_id=job["id"], status="FAILED",
                                step="바뀐 것이 없습니다", progress=100,
                                error="Claude 가 파일을 고치지 않았습니다. 요청을 더 구체적으로 적어보세요.",
                                log="바뀐 파일이 없습니다", log_level="warn")
                return
            diff, files = self.diff_of(wt, svc["base_branch"])
            self.api.report(job_id=job["id"], status="CHECKING", step="검증 중",
                            progress=55, head_sha=sha, diff=diff, files=files,
                            summary=summary or None,
                            log=f"{len(files)}개 파일을 고쳤습니다")

            self.check_cancel()
            checks = self.run_checks(wt, svc)
            ok = all(c["ok"] for c in checks) if checks else True
            if not ok:
                bad = next(c for c in checks if not c["ok"])
                self.api.report(job_id=job["id"], status="FAILED", checks=checks,
                                step="검증 실패", progress=100,
                                error=f"검증에 걸렸습니다: {bad['name']}",
                                log="검증을 통과하지 못했습니다", log_level="error")
                return

            preview = self.start_preview(job["id"], wt, svc)
            auto = job.get("approve_mode") == "auto"
            if auto:
                r = self.open_pr(wt, job, svc, merge=True)
                self.api.report(
                    job_id=job["id"],
                    status="MERGED" if r["merged"] else "PR_OPEN",
                    step="자동 승인 — 병합됨" if r["merged"] else "자동 승인 — PR 생성됨",
                    progress=100, checks=checks, preview_url=preview,
                    pr_url=r["pr_url"], pr_number=r["pr_number"],
                    log="자동 승인으로 진행했습니다")
                if r["merged"]:
                    self.stop_preview(job["id"])
                return

            self.api.report(job_id=job["id"], status="PREVIEW", checks=checks,
                            preview_url=preview, progress=100,
                            step="확인해 주세요 — 승인하면 PR을 만듭니다",
                            log="미리보기가 준비됐습니다")

        except Cancelled:
            self.stop_preview(job["id"])
            try:
                self.api.report(job_id=job["id"], status="CANCELLED", step="중지됨",
                                log="중지 요청으로 멈췄습니다", log_level="warn")
            except AgentError:
                pass
        except AgentError as e:
            logger.warning("작업 실패 %s: %s", job["id"], e)
            try:
                self.api.report(job_id=job["id"], status="FAILED", step="실패",
                                progress=100, error=str(e)[:2000],
                                log="작업이 실패했습니다", log_level="error",
                                log_detail=str(e)[:8000])
            except AgentError:
                pass
        except Exception as e:                     # 예상 못 한 것도 화면에 남긴다
            logger.exception("작업 오류 %s", job["id"])
            try:
                self.api.report(job_id=job["id"], status="FAILED", step="오류",
                                progress=100, error=f"{type(e).__name__}: {e}"[:2000],
                                log="예상하지 못한 오류", log_level="error")
            except AgentError:
                pass
        finally:
            self.job = None
            self.svc = None

    # ── 뒷정리 ──
    def prune_worktrees(self) -> None:
        """오래된 작업 폴더를 걷어낸다 — 놔두면 디스크가 찬다."""
        run(["git", "worktree", "prune"], cwd=self.cfg.repo_dir, timeout=60)
        try:
            dirs = [os.path.join(self.cfg.work_dir, d)
                    for d in os.listdir(self.cfg.work_dir)]
        except FileNotFoundError:
            return
        dirs = [d for d in dirs if os.path.isdir(d)]
        dirs.sort(key=lambda d: os.path.getmtime(d), reverse=True)
        for d in dirs[self.cfg.keep_worktrees:]:
            run(["git", "worktree", "remove", "--force", d],
                cwd=self.cfg.repo_dir, timeout=120)
            shutil.rmtree(d, ignore_errors=True)

    # ── 돌리기 ──
    def heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.api.heartbeat(self.job["id"] if self.job else None, self.tools)
            except AgentError as e:
                logger.debug("heartbeat 실패: %s", e)
            self._stop.wait(self.cfg.heartbeat_sec)

    def run_forever(self) -> None:
        logger.info("편집 에이전트 시작 — %s", self.cfg.server_url)
        threading.Thread(target=self.heartbeat_loop, daemon=True).start()
        idle = 0
        while not self._stop.is_set():
            try:
                payload = self.api.claim()
            except AgentError as e:
                logger.warning("작업을 가져오지 못했습니다: %s", e)
                self._stop.wait(min(60, self.cfg.poll_sec * 4))
                continue
            if not payload:
                idle += 1
                if idle % 60 == 0:
                    self.prune_worktrees()
                self._stop.wait(self.cfg.poll_sec)
                continue
            idle = 0
            logger.info("작업 시작 — %s", payload["job"]["title"])
            self.handle(payload)

    def stop(self) -> None:
        self._stop.set()
        for jid in list(self._previews):
            self.stop_preview(jid)
