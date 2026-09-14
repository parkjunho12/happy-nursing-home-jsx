"""Aside CLI 를 부른다 — `aside exec` 한 번이 글 한 편이다.

■ 시간이 다 되면

  Aside 가 발행 버튼을 누른 직후 멈췄을 수 있다. 그래서 시간 초과는 '실패' 가
  아니라 '모른다(uncertain)' 다. 프로세스는 죽이되 결과는 사람에게 넘긴다.
"""
from __future__ import annotations

import os
import signal
import subprocess
from typing import Dict, List, Tuple


class AsideNotFound(RuntimeError):
    pass


def command(cfg: Dict, prompt: str) -> List[str]:
    cmd = [cfg["aside_bin"], "exec"]
    if cfg.get("aside_host"):
        cmd += ["--host", cfg["aside_host"]]
    if cfg.get("aside_account"):
        cmd += ["--account", cfg["aside_account"]]
    if cfg.get("aside_model"):
        cmd += ["-m", cfg["aside_model"]]
    if cfg.get("aside_effort"):
        cmd += ["--effort", cfg["aside_effort"]]
    if cfg.get("aside_permission"):
        cmd += ["--permission", cfg["aside_permission"]]
    cmd.append(prompt)
    return cmd


def version(cfg: Dict) -> str:
    try:
        out = subprocess.run([cfg["aside_bin"], "--version"], capture_output=True,
                             text=True, timeout=20)
    except FileNotFoundError:
        raise AsideNotFound(f"Aside CLI 를 찾지 못했습니다: {cfg['aside_bin']}")
    return (out.stdout or out.stderr).strip()


def account_status(cfg: Dict) -> str:
    """`aside account status` 의 말. 로그인 여부를 사람이 읽는다."""
    try:
        out = subprocess.run([cfg["aside_bin"], "account", "status"], capture_output=True,
                             text=True, timeout=30)
    except FileNotFoundError:
        raise AsideNotFound(f"Aside CLI 를 찾지 못했습니다: {cfg['aside_bin']}")
    return ((out.stdout or "") + (out.stderr or "")).strip()


def run(cfg: Dict, prompt: str, log_path: str) -> Tuple[str, bool]:
    """(출력 전부, 시간 초과 여부). 출력은 log_path 에도 그대로 남긴다."""
    cmd = command(cfg, prompt)
    env = os.environ.copy()
    env.setdefault("NO_COLOR", "1")
    timed_out = False
    try:
        # 새 프로세스 그룹으로 띄운다 — 시간이 다 되면 Aside 가 띄운 자식까지 함께 끝내야
        # communicate() 가 파이프를 붙잡고 영영 기다리지 않는다
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, env=env, start_new_session=True)
    except FileNotFoundError:
        raise AsideNotFound(f"Aside CLI 를 찾지 못했습니다: {cfg['aside_bin']}")
    try:
        stdout, stderr = proc.communicate(timeout=int(cfg.get("aside_timeout_seconds") or 1500))
        out = (stdout or "") + ("\n" + stderr if stderr else "")
        out += f"\n[exit {proc.returncode}]"
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_group(proc)
        try:
            stdout, stderr = proc.communicate(timeout=15)
        except Exception:
            stdout, stderr = "", ""
        out = (stdout or "") + ("\n" + stderr if stderr else "") + "\n[timeout]"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write("$ " + " ".join(cmd[:-1]) + " '<prompt>'\n")
        f.write(out + "\n")
    return out, timed_out


def _kill_group(proc: "subprocess.Popen") -> None:
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
