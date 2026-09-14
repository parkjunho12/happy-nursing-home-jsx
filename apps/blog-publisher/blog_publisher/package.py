"""서버가 준 꾸러미를 Aside 가 읽을 수 있는 폴더로 푼다.

  work_dir/<draft_id>/attempt-<n>/
    01.jpg 02.jpg …   가린 사진(번호 = 본문의 [사진 n])
    post.txt          제목 · 본문 · 시설 안내 · 해시태그 — Aside 가 읽는 원고
    manifest.json     무엇을 받았는지(주소·해시) — 나중에 되짚을 때
    aside.log         Aside 가 한 말 전부

사진은 서버가 '가린 파생본' 만 준다. 원본은 여기 오지 않는다.
시도마다 폴더를 따로 둔다 — 앞선 시도의 aside.log 가 '올라갔는지' 를 가리는
유일한 증거일 때가 있다.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
import urllib.request
from typing import Any, Dict, List

JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG"
MAX_PHOTO_BYTES = 30 * 1024 * 1024


class PackageError(RuntimeError):
    """사진을 못 받았다 — 아무것도 올리지 않았으므로 다시 해도 된다."""


def _download(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "blog-publisher/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise PackageError("사진 파일이 너무 큽니다")
    return data


def prepare(pkg: Dict[str, Any], work_dir: str) -> str:
    """폴더를 만들고 채운다. 폴더 경로를 돌려준다."""
    attempt = int(pkg.get("attempt") or 0)
    folder = os.path.join(work_dir, pkg["draft_id"], f"attempt-{attempt}")
    n = 0
    while os.path.isdir(folder):          # 같은 회차가 또 오면 옆에 둔다. 지우지 않는다
        n += 1
        folder = os.path.join(work_dir, pkg["draft_id"], f"attempt-{attempt}-{n}")
    os.makedirs(folder)

    photos: List[Dict[str, Any]] = pkg.get("photos") or []
    if not photos:
        raise PackageError("사진이 한 장도 없습니다")
    manifest = []
    for p in photos:
        raw = _download(p["url"])
        if len(raw) < 1024 or not (raw.startswith(JPEG_MAGIC) or raw.startswith(PNG_MAGIC)):
            raise PackageError(f"[사진 {p['no']}] 이 그림 파일이 아닙니다")
        name = p.get("file_name") or f"{int(p['no']):02d}.jpg"
        with open(os.path.join(folder, name), "wb") as f:
            f.write(raw)
        manifest.append({"no": p["no"], "file": name, "url": p["url"],
                         "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)})

    with open(os.path.join(folder, "post.txt"), "w", encoding="utf-8") as f:
        f.write(post_text(pkg))
    with open(os.path.join(folder, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"draft_id": pkg["draft_id"], "title": pkg["title"],
                   "attempt": pkg.get("attempt"), "photos": manifest,
                   "prepared_at": time.strftime("%Y-%m-%d %H:%M:%S")},
                  f, ensure_ascii=False, indent=2)
    return folder


def post_text(pkg: Dict[str, Any]) -> str:
    """Aside 에게 주는 원고. 사람이 읽어도 그대로 붙여넣을 수 있는 모양."""
    tags = " ".join(f"#{t.lstrip('#')}" for t in (pkg.get("hashtags") or []))
    parts = [f"제목: {pkg['title']}", "", "본문:", pkg["body"].rstrip(), ""]
    if pkg.get("facility"):
        parts += [pkg["facility"].rstrip(), ""]
    if tags:
        parts += [f"태그: {tags}", ""]
    return "\n".join(parts)


def sweep(work_dir: str, keep_days: int) -> int:
    """오래된 작업 폴더를 지운다. 지운 개수."""
    if not os.path.isdir(work_dir):
        return 0
    cutoff = time.time() - keep_days * 86400
    n = 0
    for name in os.listdir(work_dir):
        p = os.path.join(work_dir, name)
        try:
            if os.path.isdir(p) and os.path.getmtime(p) < cutoff:
                shutil.rmtree(p)
                n += 1
        except OSError:
            pass
    return n
