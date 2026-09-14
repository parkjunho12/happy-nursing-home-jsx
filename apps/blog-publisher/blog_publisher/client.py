"""서버와 말하는 쪽 — 표준 라이브러리 urllib 만 쓴다(설치 없이 돈다)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class ApiError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class ApiClient:
    def __init__(self, base_url: str, token: str, name: str, timeout: int = 30):
        self.base = base_url.rstrip("/")
        self.token = token
        self.name = name
        self.timeout = timeout

    def _req(self, method: str, path: str, body: Optional[dict] = None) -> Dict[str, Any]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        req.add_header("X-Publisher-Token", self.token)
        req.add_header("X-Publisher-Name", self.name)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            try:
                detail = json.loads(e.read().decode("utf-8")).get("detail")
            except Exception:
                detail = e.reason
            raise ApiError(e.code, str(detail)) from None
        out = json.loads(raw) if raw else {}
        if not out.get("success", True):
            raise ApiError(200, out.get("message") or out.get("error") or "실패")
        return out.get("data", out)

    P = "/api/v1/admin/blog-drafts/publisher"

    def heartbeat(self, info: dict) -> None:
        self._req("POST", f"{self.P}/heartbeat", info)

    def next(self) -> Dict[str, Any]:
        """{'draft': 꾸러미 | None, 'skipped'?: id, 'reason'?: str}"""
        return self._req("POST", f"{self.P}/next")

    def result(self, draft_id: str, *, result: str, url: Optional[str] = None,
               error: Optional[str] = None, session_id: Optional[str] = None,
               verified: bool = False, blog_id: Optional[str] = None) -> Dict[str, Any]:
        return self._req("POST", f"{self.P}/{draft_id}/result", {
            "result": result, "url": url, "error": error,
            "session_id": session_id, "verified": verified, "blog_id": blog_id,
        })
