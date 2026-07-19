"""
인수인계 기록지(수기) 사진 → AI 판독 리포트

- 1순위: Claude 비전(한글 손글씨 판독), 실패 시 2순위: OpenAI 비전
- 출력: 항목별 구조화 + 요약 + 긴급 알림 + 후속 체크리스트 제안
- 모든 호출은 동기 SDK + 지연 import (패키지 없어도 부팅 안 깨짐)
"""
from __future__ import annotations
import base64
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))

VALID_FREQ = {"one_time", "daily", "weekly", "monthly", "quarterly", "half-yearly", "yearly"}
URGENCY = {"high", "medium", "low"}

SYSTEM_PROMPT = """당신은 한국 요양원의 야간 인수인계 기록지를 판독하는 간호 기록 전문가입니다.
사진은 손으로 쓴 '어르신 인수인계' 표이며 열은 보통 [월일, 시간, 어르신, 내용, 작성자] 입니다.

규칙:
1) 판독이 불확실한 글자는 추측하지 말고 원문에 가깝게 적되, 확신이 낮으면 confidence를 'low'로 표시합니다.
2) 여러 줄이 같은 어르신에 대한 연속 기록이면 하나의 항목으로 합칩니다(시간 순서 유지).
3) 낙상, 119, 응급, 병원 이송, 발열, 출혈, 의식저하, 투약 사고, 무단외출은 반드시 urgency='high' 로 표시합니다.
4) 활력징후(혈압/체온/맥박)는 vitals 에 원문 그대로 넣습니다.
5) 존재하지 않는 내용을 지어내지 않습니다. 판독 불가한 칸은 빈 문자열로 둡니다.
6) 반드시 JSON 만 출력합니다. 설명 문장을 덧붙이지 않습니다.
7) 후속 조치(suggested_checklists)는 모두 '한 번 하고 끝나는 일회성 업무'로 제안합니다.
   반복 주기를 만들지 말고, 대신 '언제까지 해야 하는지'를 반드시 판단해 넣습니다.
   며칠간 관찰이 필요하면 '○일까지 경과 관찰 후 기록' 처럼 마감일이 있는 한 건으로 제안합니다.
   - due_days = 오늘로부터 며칠 안에 해야 하는지(정수). 0=오늘 중, 1=내일까지.
     · 응급 이송·낙상 직후 상태확인·보호자 연락 → 0
     · 통증/부종/발열 경과관찰, 병원 결과 확인 → 1~2
     · 욕창·피부 재확인, 식이 조정 확인 → 2~3
     · 물품 신청, 기록 보완 같은 행정 → 3~7
   - due_label = due_days 를 사람이 읽는 표현('오늘 중', '내일까지', '3일 내')으로 씁니다.

출력 JSON 스키마:
{
  "entries": [
    {"date":"", "time":"", "resident":"", "content":"", "writer":"",
     "vitals":"", "category":"낙상|응급|투약|활력징후|배설|식사|수면|행동|기타",
     "urgency":"high|medium|low", "confidence":"high|medium|low"}
  ],
  "summary": "인계받는 사람이 30초 안에 파악하도록 짧은 문장 3~4개. 긴급/이송/낙상 같은 중대 사항을 맨 앞 문장에. 어려운 한자어 대신 쉬운 말로. 각 문장은 40자 이내.",
  "key_points": ["행동 중심 한 줄 3~6개. '어르신 이름 - 무엇을 확인/조치' 형태로 15~30자. 예: '맹○영 - 병원 이송, 오전 상태 확인 필요'"],
  "alerts": [{"resident":"", "issue":"", "action":"권장 후속 조치"}],
  "suggested_checklists": [
    {"title":"", "person_name":"", "reason":"", "due_days": 0, "due_label":"오늘 중"}
  ],
  "unreadable_notes": "판독이 어려웠던 부분 설명(없으면 빈 문자열)"
}"""

USER_PROMPT = """다음은 요양원 인수인계 기록지 사진입니다(여러 장일 수 있음).
모두 판독해 하나의 리포트로 합쳐 주세요. 시간 순으로 정렬합니다.
후속 체크리스트는 실제로 조치가 필요한 항목만 최대 6개 제안하세요."""


def _safe_parse_json(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    a, b = s.find("{"), s.rfind("}")
    if a != -1 and b != -1:
        try:
            return json.loads(s[a:b + 1])
        except Exception:
            pass
    return None


def _normalize(d: Dict[str, Any]) -> Dict[str, Any]:
    """모델 출력 정규화 — 프론트가 항상 같은 모양을 받도록."""
    out: Dict[str, Any] = {
        "entries": [], "summary": "", "key_points": [], "alerts": [],
        "suggested_checklists": [], "unreadable_notes": "",
    }
    if not isinstance(d, dict):
        return out

    for e in (d.get("entries") or []):
        if not isinstance(e, dict):
            continue
        u = str(e.get("urgency") or "low").lower()
        out["entries"].append({
            "date": str(e.get("date") or ""),
            "time": str(e.get("time") or ""),
            "resident": str(e.get("resident") or ""),
            "content": str(e.get("content") or ""),
            "writer": str(e.get("writer") or ""),
            "vitals": str(e.get("vitals") or ""),
            "category": str(e.get("category") or "기타"),
            "urgency": u if u in URGENCY else "low",
            "confidence": str(e.get("confidence") or "medium"),
        })

    out["summary"] = str(d.get("summary") or "")
    out["key_points"] = [str(x).strip() for x in (d.get("key_points") or [])
                         if x is not None and str(x).strip() and str(x).strip().lower() != "none"]
    out["unreadable_notes"] = str(d.get("unreadable_notes") or "")

    for a in (d.get("alerts") or []):
        if isinstance(a, dict):
            out["alerts"].append({
                "resident": str(a.get("resident") or ""),
                "issue": str(a.get("issue") or ""),
                "action": str(a.get("action") or ""),
            })

    today = datetime.now(KST).date()
    for c in (d.get("suggested_checklists") or []):
        if not isinstance(c, dict):
            continue
        # 후속 조치는 항상 일회성(one_time) — 기한(due_date)으로 관리
        try:
            dd = int(c.get("due_days"))
        except Exception:
            dd = 1
        dd = max(0, min(dd, 90))
        due_date = (today + timedelta(days=dd)).isoformat()
        label = str(c.get("due_label") or "").strip() or (
            "오늘 중" if dd == 0 else "내일까지" if dd == 1 else f"{dd}일 내")
        out["suggested_checklists"].append({
            "title": str(c.get("title") or "").strip(),
            "frequency": "one_time",
            "person_name": str(c.get("person_name") or ""),
            "reason": str(c.get("reason") or ""),
            "due_days": dd,
            "due_date": due_date,      # one_time 기한 (YYYY-MM-DD)
            "due_label": label,
        })
    out["suggested_checklists"] = [c for c in out["suggested_checklists"] if c["title"]]
    return out


def _claude_read(images: List[bytes], media_types: List[str]) -> Optional[Dict[str, Any]]:
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=180)
        content: List[Dict[str, Any]] = []
        for b, mt in zip(images, media_types):
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": mt,
                           "data": base64.b64encode(b).decode()},
            })
        content.append({"type": "text", "text": USER_PROMPT})
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL, max_tokens=4000, temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        return _safe_parse_json(msg.content[0].text)
    except Exception as e:
        logger.warning(f"[handover] Claude 판독 실패: {e}")
        return None


def _openai_read(images: List[bytes], media_types: List[str]) -> Optional[Dict[str, Any]]:
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=180)
        parts: List[Dict[str, Any]] = [{"type": "text", "text": USER_PROMPT}]
        for b, mt in zip(images, media_types):
            parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mt};base64,{base64.b64encode(b).decode()}",
                              "detail": "high"},   # 손글씨 → high 필수
            })
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL, temperature=0, max_tokens=4000,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": SYSTEM_PROMPT},
                      {"role": "user", "content": parts}],
        )
        return _safe_parse_json(resp.choices[0].message.content or "")
    except Exception as e:
        logger.warning(f"[handover] OpenAI 판독 실패: {e}")
        return None


def analyze_handover(images: List[bytes], media_types: List[str]) -> Dict[str, Any]:
    """사진들을 판독해 리포트 반환. 사용한 모델과 실패 사유를 함께 담는다."""
    used = None
    parsed = _claude_read(images, media_types)
    if parsed:
        used = f"claude:{settings.CLAUDE_MODEL}"
    else:
        parsed = _openai_read(images, media_types)
        if parsed:
            used = f"openai:{settings.OPENAI_MODEL}"

    if not parsed:
        return {
            **_normalize({}),
            "model": None,
            "error": "AI 판독에 실패했습니다. 사진이 선명한지 확인 후 다시 시도해 주세요.",
        }
    report = _normalize(parsed)
    report["model"] = used
    report["error"] = ""
    return report
