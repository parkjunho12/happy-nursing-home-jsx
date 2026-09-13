"""회의 준비 AI — 카카오톡 대화 내보내기(txt)로 회의 준비 문서를 만든다

- 지연 import: anthropic 패키지가 없어도 부팅이 깨지지 않는다 (handover_ai 와 동일 원칙)
- 대화가 길면 최근 부분만 사용 — 회의 안건은 보통 파일 끝쪽(최근 대화)에 있다
"""
from __future__ import annotations
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))
MAX_CHARS = 35_000   # Claude 에 넘길 대화 최대 길이 (초과 시 뒤에서부터 자름)

# 회의 내용이 아닌 시스템 메시지 — 토큰 낭비 방지용 사전 제거
_SYSTEM_LINE = re.compile(
    r"(님이 (들어왔습니다|나갔습니다)|님을 초대했습니다|삭제된 메시지입니다"
    r"|채팅방 관리자가 메시지를 가렸습니다)"
)

_PROMPT = """아래는 요양원 직원들의 카카오톡 단체 대화 내용입니다.
(형식은 "[이름] [오후 2:31] 내용" 또는 "2026. 9. 14. 오후 2:31, 이름 : 내용" 중 하나)
오늘은 {today} 입니다.

당신은 요양원 원장(관리자)의 회의 준비를 돕습니다. 이 대화를 읽고,
다가오는 직원회의에서 원장이 챙겨야 할 것들을 회의 준비 문서로 만들어 주세요.

규칙:
- 잡담·인사·이모티콘·사진 표시는 제외하고 업무 내용만 봅니다.
- 대화에 나온 사실만 쓰고, 지어내지 않습니다.
- 본문은 마크다운이 아닌 일반 텍스트입니다. #, **, - 같은 마크다운 문법을 쓰지 마세요.
- 본문 형식 (해당 없는 섹션은 생략):

■ 대화 기간: 대화에 나온 날짜 범위
■ 관련 직원: 대화에 등장한 발화자 이름들

[회의 안건]
1. 주제 — 대화에서 나온 배경·현황 요약

[결정이 필요한 것]
· 회의에서 정해야 할 사항 (대화에서 결론이 안 난 것)

[챙겨야 할 것]
· 원장이 확인·준비·전달해야 할 일 (담당자가 있으면 담당자 표기)

[미결·확인 필요]
· 대화에서 답이 없었거나 흐지부지된 것

- 제목은 "9/15(월) 회의 준비" 처럼 다가오는 회의 날짜 기준으로 짧게 짓습니다.
  (회의 날짜를 알 수 없으면 대화 마지막 날짜 기준으로 "9/14 회의 준비")
- 반드시 아래 JSON 형식으로만 답하세요:
{{"title": "제목", "content": "본문"}}

대화 내용:
"""


def _clean(text: str) -> str:
    lines = [ln for ln in text.splitlines() if not _SYSTEM_LINE.search(ln)]
    out = "\n".join(lines).strip()
    if len(out) > MAX_CHARS:
        cut = out[-MAX_CHARS:]
        # 잘린 첫 줄은 문장 중간일 수 있으니 다음 줄부터 시작
        nl = cut.find("\n")
        out = cut[nl + 1:] if 0 <= nl < 2000 else cut
    return out


def _parse_json(raw: str) -> Optional[Dict[str, str]]:
    raw = raw.strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except Exception:
        return None
    title = str(d.get("title") or "").strip()
    content = str(d.get("content") or "").strip()
    if not (title and content):
        return None
    return {"title": title, "content": content}


def prepare_meeting_chat(text: str) -> Tuple[Optional[Dict[str, str]], Optional[str]]:
    """대화 원문 → ({title, content}, None) 또는 (None, 오류메시지)."""
    if not settings.ANTHROPIC_API_KEY:
        return None, "ANTHROPIC_API_KEY 미설정"
    chat = _clean(text)
    if len(chat) < 30:
        return None, "대화 내용이 너무 짧습니다. 카카오톡 '대화 내용 내보내기(텍스트만)' 파일인지 확인해 주세요."
    today = datetime.now(KST).strftime("%Y년 %m월 %d일")
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180)
        res = client.messages.create(
            model=settings.CLAUDE_MODEL, max_tokens=4000, temperature=0,
            messages=[{"role": "user", "content": _PROMPT.format(today=today) + chat}],
        )
        raw = "".join(b.text for b in res.content if getattr(b, "type", "") == "text")
    except Exception as e:
        logger.warning("meeting_ai: Claude 호출 실패: %s", e)
        return None, f"AI 호출 실패: {e}"
    parsed = _parse_json(raw)
    if not parsed:
        logger.warning("meeting_ai: 응답 파싱 실패: %.300s", raw)
        return None, "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요."
    return parsed, None
