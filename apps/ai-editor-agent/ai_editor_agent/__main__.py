"""편집 에이전트 실행기.

  python -m ai_editor_agent register --code <등록코드>
  python -m ai_editor_agent run
  python -m ai_editor_agent info

설정은 config.json 에 둔다(토큰이 들어가므로 git 에 올리지 않는다).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import socket
import sys

from .agent import ApiClient, Config, EditorAgent, detect_tools, AGENT_VERSION

CONFIG = os.environ.get("AI_EDITOR_CONFIG", "config.json")


def load() -> dict:
    if not os.path.exists(CONFIG):
        return {}
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def save(d: dict) -> None:
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)


def cfg_of(d: dict) -> Config:
    here = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    return Config(
        server_url=d.get("server_url") or "http://localhost:8010",
        repo_dir=os.path.abspath(d.get("repo_dir") or here),
        work_dir=os.path.abspath(d.get("work_dir")
                                 or os.path.join(here, "..", ".ai-editor-worktrees")),
        agent_id=d.get("agent_id") or "editor-1",
        name=d.get("name") or "편집 에이전트",
        agent_token=d.get("agent_token"),
        preview_host=d.get("preview_host") or "127.0.0.1",
        preview_base=d.get("preview_base") or None,
        preview_port=int(d.get("preview_port") or 0),
        keep_worktrees=int(d.get("keep_worktrees") or 5),
    )


def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(prog="ai_editor_agent")
    sub = ap.add_subparsers(dest="cmd")

    r = sub.add_parser("register", help="서버에 등록 (한 번만)")
    r.add_argument("--code", required=True, help="서버 .env 의 AI_EDITOR_ENROLL_CODE")
    r.add_argument("--agent-id", default=None)
    r.add_argument("--name", default=None)
    r.add_argument("--server", default=None)

    sub.add_parser("run", help="작업을 받아 처리한다")
    sub.add_parser("info", help="지금 상태와 쓸 수 있는 도구를 보여준다")

    a = ap.parse_args()
    d = load()

    if a.cmd == "register":
        if a.server:
            d["server_url"] = a.server
        if a.agent_id:
            d["agent_id"] = a.agent_id
        if a.name:
            d["name"] = a.name
        c = cfg_of(d)
        tools = detect_tools()
        if not tools.get("claude"):
            print("✗ Claude CLI 를 찾을 수 없습니다. 이 기계에 설치하고 로그인해주세요.")
            return 1
        api = ApiClient(c.server_url)
        try:
            token = api.register(a.code, c.agent_id, c.name, tools)
        except Exception as e:
            print(f"✗ 등록 실패: {e}")
            return 1
        d.update({"server_url": c.server_url, "agent_id": c.agent_id,
                  "name": c.name, "agent_token": token})
        save(d)
        print(f"✓ 등록 완료 — {c.agent_id} ({c.name})")
        print(f"  설정 파일: {os.path.abspath(CONFIG)}  ← 토큰이 들어 있으니 공유하지 마세요")
        return 0

    if a.cmd == "info":
        c = cfg_of(d)
        tools = detect_tools()
        print(f"에이전트 {AGENT_VERSION} · {socket.gethostname()}")
        print(f"  서버      : {c.server_url}")
        print(f"  저장소    : {c.repo_dir}")
        print(f"  작업 폴더 : {c.work_dir}")
        print(f"  등록      : {'됨' if d.get('agent_token') else '안 됨 — register 먼저'}")
        print("  도구      :")
        for k in ("claude", "gh", "git", "node", "pnpm"):
            v = tools.get(k)
            print(f"    {k:<7} {v or '✗ 없음'}")
        print(f"    gh 로그인 {'됨' if tools.get('gh_auth') else '✗ 안 됨 (PR 을 만들 수 없습니다)'}")
        ok = bool(tools.get("claude") and tools.get("git") and d.get("agent_token"))
        print("\n" + ("✓ 작업할 준비가 됐습니다" if ok else "✗ 아직 준비되지 않았습니다"))
        return 0 if ok else 1

    if a.cmd == "run":
        c = cfg_of(d)
        if not c.agent_token:
            print("✗ 먼저 register 로 등록해주세요.")
            return 2
        agent = EditorAgent(c)
        try:
            agent.run_forever()
        except KeyboardInterrupt:
            agent.stop()
            print("\n멈췄습니다.")
        return 0

    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
