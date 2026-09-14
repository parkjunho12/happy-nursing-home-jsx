"""Aside 에게 주는 지시문과, Aside 가 돌려준 말을 읽는 규칙.

■ 왜 자연어 지시인가

  네이버 글쓰기 화면(스마트에디터)은 iframe 과 자체 편집기로 되어 있어 CSS
  선택자를 박아 두면 개편 한 번에 다 깨진다. Aside 의 브라우저 에이전트는
  화면을 보고 조작하므로 그런 변화를 견딘다. 대신 '무엇을 하면 안 되는가'
  와 '끝났을 때 무엇을 말하라' 를 못박아 둔다.

■ 결과 한 줄

  Aside 가 무슨 말을 하든 RESULT: 줄만 믿는다.

    RESULT: PUBLISHED <글 주소>       올렸고 주소를 읽었다
    RESULT: FAILED <이유>             아무것도 올리지 않았다 — 다시 해도 된다
    RESULT: UNCERTAIN <이유>          발행을 눌렀는데 확인이 안 된다 — 사람이 본다

  이 줄이 없으면 UNCERTAIN 으로 본다. 모르는 것을 '실패' 로 보고 다시 올리면
  같은 글이 두 번 올라간다.

  줄이 여럿이면 '다시 올리지 않는 쪽' 으로 읽는다 — PUBLISHED 가 하나라도 있으면
  올린 것이고, 아니면 UNCERTAIN 이 하나라도 있으면 모르는 것이며, 전부 FAILED 일
  때만 실패다. 에이전트가 올린 뒤에 주소를 못 읽고 FAILED 라고 고쳐 말해도
  다시 올리지 않는다.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

RESULT_RE = re.compile(r"^\s*RESULT:\s*(PUBLISHED|FAILED|UNCERTAIN)\b\s*(.*)$", re.M)
SESSION_RE = re.compile(r"\b(ses_[A-Za-z0-9]{6,})\b")

# 이 말이 있으면 Aside 가 브라우저를 열기도 전에 멈춘 것이다 — 아무것도 안 올라갔다
PRESTART_ERRORS = (
    "Aside isn't running",
    "Failed to request daemon auth challenge",
    "not signed in",
    "signed out",
    "Unknown host",
    "host not found",
    "No such host",
)


def build(pkg: Dict[str, Any], folder: str, blog_id: str) -> str:
    n = len(pkg.get("photos") or [])
    files = ", ".join(p.get("file_name") or f"{int(p['no']):02d}.jpg" for p in pkg["photos"])
    tags = " ".join(f"#{t.lstrip('#')}" for t in (pkg.get("hashtags") or []))
    body = pkg["body"].rstrip()
    facility = (pkg.get("facility") or "").rstrip()
    return f"""네이버 블로그(아이디 {blog_id})에 새 글 한 편을 올려라. 아래 원고를 글자 하나 바꾸지 말고 그대로 쓴다.

## 준비물
- 원고 파일: {folder}/post.txt
- 사진 {n}장: {folder}/ 안의 {files}
  (파일 번호가 본문의 [사진 1] [사진 2] … 자리다)

## 하지 말 것
- 네이버에 로그인되어 있지 않으면 로그인을 시도하지 말고 즉시 `RESULT: FAILED 네이버 로그인 필요` 를 출력하고 끝내라.
- 다른 글을 열거나 고치지 마라. 다른 사이트에 가지 마라. 원고에 없는 문장을 넣지 마라.
- 발행 버튼은 아래 확인을 모두 마친 뒤 딱 한 번만 누른다. 두 번 누르지 마라.
- 발행 대신 '예약 발행' 이나 '임시저장' 으로 끝내지 마라.

## 순서
1. https://blog.naver.com/{blog_id}/postwrite 를 연다. 편집기가 안 열리면 https://blog.naver.com/PostWriteForm.naver?blogId={blog_id} 를 연다.
   '작성 중인 글이 있습니다' 같은 임시저장 복구 창이 뜨면 복구하지 말고 새 글로 시작한다.
2. 제목 칸에 아래 제목을 넣는다.
   제목: {pkg['title']}
3. 본문을 아래 순서대로 넣는다. 문단은 빈 줄로 나눈다. '■ ' 로 시작하는 줄은 소제목이다.
   [사진 n] 이라는 글자는 본문에 남기지 말고, 그 자리에 {folder}/ 의 n번 사진 파일을 올린다(사진 추가 → 내 컴퓨터에서 파일 선택).
   괄호로 싸인 한 줄은 사진 설명이다 — 사진 바로 아래에 글로 둔다.
--- 본문 시작 ---
{body}
--- 본문 끝 ---
4. 본문 끝에 아래 시설 안내를 그대로 붙인다.
--- 시설 안내 시작 ---
{facility}
--- 시설 안내 끝 ---
5. 태그 칸에 넣는다: {tags if tags else '(태그 없음)'}
6. 발행 전 확인 — 하나라도 어긋나면 발행하지 말고 `RESULT: FAILED <무엇이 어긋났는지>` 를 출력하고 끝내라.
   - 본문에 사진이 정확히 {n}장 들어 있다
   - 본문에 '[사진' 이라는 글자가 남아 있지 않다
   - 제목이 원고와 같다
7. 발행 설정은 '전체공개' 로 두고, 다른 설정은 건드리지 않는다. 발행 버튼을 한 번 누른다.
8. 발행된 글 페이지가 열리면 주소창의 주소를 읽는다. 주소는 https://blog.naver.com/{blog_id}/숫자 모양이거나 logNo=숫자 가 들어 있다.

## 마지막 줄
무슨 일이 있었든 출력의 마지막 줄은 아래 셋 중 하나여야 한다. 다른 말은 그 위에 써라.
- RESULT: PUBLISHED <발행된 글 주소>
- RESULT: FAILED <이유>          ← 발행 버튼을 누르지 않은 경우에만
- RESULT: UNCERTAIN <이유>       ← 발행 버튼을 눌렀는데 글 주소를 확인하지 못한 경우
"""


# 브라우저를 열기 전에 멈춘 출력은 짧다. 이보다 길면 무언가 하다가 멈춘 것이다
PRESTART_MAX_CHARS = 1500
PRESTART_MAX_LINES = 20


def parse(output: str) -> Tuple[str, str]:
    """Aside 출력 → ('ok'|'failed'|'uncertain', 나머지 말).

    RESULT 줄이 여럿이면 '다시 올리지 않는 쪽' 으로 읽는다:
    PUBLISHED 가 있으면 ok(마지막 PUBLISHED 의 주소), 아니면 UNCERTAIN 이 있으면
    uncertain, 전부 FAILED 일 때만 failed.
    """
    out = output or ""
    hits = RESULT_RE.findall(out)
    if not hits:
        if _prestart_failure(out):
            return "failed", "Aside 가 브라우저를 열지 못했습니다: " + _first_line(out)
        return "uncertain", "Aside 가 결과 줄(RESULT:)을 남기지 않았습니다"
    by_kind = {}
    for kind, rest in hits:
        by_kind[kind] = (rest or "").strip()       # 같은 종류면 마지막 것
    if "PUBLISHED" in by_kind:
        return "ok", by_kind["PUBLISHED"]
    if "UNCERTAIN" in by_kind:
        return "uncertain", by_kind["UNCERTAIN"]
    return "failed", by_kind["FAILED"]


def _prestart_failure(out: str) -> bool:
    """브라우저를 열기도 전에 멈췄는가 — 짧은 출력의 앞머리에 그 말이 있을 때만."""
    if len(out) > PRESTART_MAX_CHARS:
        return False
    head = "\n".join(out.splitlines()[:PRESTART_MAX_LINES]).lower()
    return any(e.lower() in head for e in PRESTART_ERRORS)


def session_id(output: str) -> Optional[str]:
    m = SESSION_RE.search(output or "")
    return m.group(1) if m else None


def _first_line(s: str) -> str:
    for line in (s or "").splitlines():
        if line.strip():
            return line.strip()[:200]
    return ""
