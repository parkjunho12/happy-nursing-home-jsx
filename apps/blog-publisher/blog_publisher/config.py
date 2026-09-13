"""설정 — config.json 한 파일. 환경변수 BLOG_PUBLISHER_<KEY> 가 있으면 그것이 이긴다.

토큰이 들어 있으므로 config.json 은 git 에 올리지 않는다(.gitignore).
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict

DEFAULT_CONFIG = os.path.expanduser("~/.blog-publisher/config.json")

DEFAULTS: Dict[str, Any] = {
    # 서버
    "server_url": "https://api.xn--p80bu1t60gba47bg6abm347gsla.com",
    "publisher_token": "",            # 서버 .env 의 BLOG_PUBLISHER_TOKEN 과 같은 값
    "publisher_name": "",             # 관리자 화면에 보일 이름. 비우면 이 Mac 의 호스트명
    # 네이버
    "naver_blog_id": "",              # https://blog.naver.com/<이것>
    # Aside
    "aside_bin": "aside",             # CLI 경로. PATH 에 있으면 그대로
    "aside_host": "",                 # 다른 Mac 이나 Aside Cloud 에서 돌릴 때 (aside host list)
    "aside_account": "",              # 네이버에 로그인해 둔 Aside 프로필 (u0, u1 …). 비우면 기본
    "aside_model": "",                # 비우면 Aside 설정의 기본 모델
    "aside_effort": "high",           # 편집기 조작이 많아 low 로는 자주 놓친다
    "aside_permission": "full-access",  # 사진 폴더를 읽어야 한다. guard 는 무인 실행에서 멈춘다
    "aside_timeout_seconds": 1500,    # 25분. 사진 8장 올리고 발행하는 데 보통 3~6분
    # 동작
    "poll_seconds": 300,              # 서버에 '발행할 것 있나' 묻는 간격
    "work_dir": "~/BlogPublisher",    # 사진·본문·로그를 두는 곳. 가린 사진만 온다
    "keep_days": 14,                  # 작업 폴더 보관 기간
}


def load(path: str = DEFAULT_CONFIG) -> Dict[str, Any]:
    cfg = dict(DEFAULTS)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            cfg.update(json.load(f) or {})
    for key in DEFAULTS:
        env = os.environ.get(f"BLOG_PUBLISHER_{key.upper()}")
        if env not in (None, ""):
            cfg[key] = type(DEFAULTS[key])(env) if isinstance(DEFAULTS[key], (int, float)) else env
    cfg["work_dir"] = os.path.expanduser(cfg["work_dir"])
    if not cfg["publisher_name"]:
        import socket
        cfg["publisher_name"] = socket.gethostname().split(".")[0]
    return cfg


def save(cfg: Dict[str, Any], path: str = DEFAULT_CONFIG) -> None:
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    # 토큰이 들어간다 — 처음부터 나만 읽는 권한으로 만든다
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump({k: cfg.get(k, v) for k, v in DEFAULTS.items()}, f,
                  ensure_ascii=False, indent=2)
    os.chmod(path, 0o600)


def missing(cfg: Dict[str, Any]) -> list:
    """돌기 전에 꼭 있어야 하는 것."""
    out = []
    if not cfg.get("publisher_token"):
        out.append("publisher_token (서버 BLOG_PUBLISHER_TOKEN 과 같은 값)")
    if not cfg.get("naver_blog_id"):
        out.append("naver_blog_id (네이버 블로그 아이디)")
    if not cfg.get("server_url"):
        out.append("server_url")
    return out
