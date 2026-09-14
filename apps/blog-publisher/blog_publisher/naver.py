"""올라간 글을 실제로 열어 본다 — Aside 의 말만 믿지 않는다.

네이버 글 페이지는 로그인 없이 읽힌다(PostView). 제목이 보이면 '확인됨' 으로
서버에 알린다. 못 열어도 실패는 아니다 — 네이버가 봇을 막거나 반영이 늦을 수
있으니, 그때는 '확인 못 함' 으로 보내고 사람이 한 번 본다.
"""
from __future__ import annotations

import html
import re
import urllib.request
from typing import Optional, Tuple

URL_RE = [
    re.compile(r"https?://(?:m\.)?blog\.naver\.com/([A-Za-z0-9_\-]+)/(\d{6,})"),
    re.compile(r"blogId=([A-Za-z0-9_\-]+)[^\s\"'<>]*?logNo=(\d{6,})"),
    re.compile(r"logNo=(\d{6,})[^\s\"'<>]*?blogId=([A-Za-z0-9_\-]+)"),
]


def parse(text: str) -> Optional[Tuple[str, str]]:
    """(blogId, logNo)"""
    for i, pat in enumerate(URL_RE):
        m = pat.search(text or "")
        if m:
            a, b = m.group(1), m.group(2)
            return (b, a) if i == 2 else (a, b)
    return None


def verify(url_text: str, title: str, timeout: int = 20) -> Tuple[bool, str]:
    """(확인됨?, 설명)"""
    p = parse(url_text)
    if not p:
        return False, "글 주소를 읽지 못했습니다"
    blog_id, log_no = p
    view = f"https://blog.naver.com/PostView.naver?blogId={blog_id}&logNo={log_no}"
    try:
        req = urllib.request.Request(view, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh) blog-publisher/0.1"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if r.status != 200:
                return False, f"글 페이지 응답 {r.status}"
            page = r.read(400_000).decode("utf-8", "ignore")
    except Exception as e:
        return False, f"글 페이지를 열지 못했습니다({type(e).__name__})"
    text = html.unescape(re.sub(r"<[^>]+>", " ", page))
    key = (title or "").strip()[:20]
    if key and key in text:
        return True, "글 페이지에서 제목을 확인했습니다"
    return False, "글 페이지는 열렸지만 제목을 찾지 못했습니다"
