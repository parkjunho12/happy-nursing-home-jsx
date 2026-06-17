"""
LLM 요약 생성 — Claude 우선, OpenAI fallback
원본 데이터 전달 없이 집계 결과만 전달
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RESIDENT_FOR_LLM = 20
MAX_ISSUES_FOR_LLM   = 30

SYSTEM_PROMPT = """당신은 한국 노인요양시설 제공기록지 검수 결과를 요약하는 전문가입니다.
입력은 Python Rule Engine이 이미 판정한 결과입니다.
새로운 오류를 생성하거나 score/grade를 변경하지 마세요.
반드시 JSON만 반환하세요 (마크다운 ``` 절대 금지).

{{
  "summary": "원장/사회복지사가 바로 이해하는 전체 검수 결과 한 줄 요약",
  "admin_comment": "핵심 문제와 배경 설명 (2~3문장)",
  "priority_actions": ["즉시 처리 사항 1", "즉시 처리 사항 2", "즉시 처리 사항 3"],
  "recording_tips": ["기록 개선 팁 1", "기록 개선 팁 2"]
}}"""


def _safe_parse(raw: str) -> Optional[Dict]:
    raw = raw.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw).strip()
    try: return json.loads(raw)
    except Exception: pass
    s, e = raw.find('{'), raw.rfind('}')
    if s != -1 and e != -1:
        try: return json.loads(raw[s:e+1])
        except Exception: pass
    return None


def _fallback(agg: Dict) -> Dict:
    iss = agg.get("issue_summary", {})
    return {
        "summary": f"전체 {agg.get('total_residents_detected',0)}명 수급자 검수 완료. "
                   f"점수 {agg.get('score',0)}점 ({agg.get('grade','')})",
        "admin_comment": f"HIGH 이슈 {iss.get('high',0)}건, MEDIUM {iss.get('medium',0)}건이 확인됩니다. "
                         "아래 우선 조치 사항을 확인하세요.",
        "priority_actions": [
            "HIGH 등급 이슈를 우선 확인하세요.",
            "작성자 누락·혈압체온 미기재 항목을 점검하세요.",
            "휴무자 작성 기록 여부를 확인하세요.",
        ],
        "recording_tips": [
            "매일 혈압·체온을 빠짐없이 기록하세요.",
            "각 섹션 작성자 성명란을 반드시 기재하세요.",
        ],
    }


def generate_summary(aggregate: Dict) -> Dict:
    """집계 결과만 LLM에 전달"""
    # 상위 이슈만 추출
    top_issues = []
    for rr in aggregate.get("resident_results", [])[:MAX_RESIDENT_FOR_LLM]:
        for iss in rr.get("issues", [])[:3]:
            if iss.get("severity") in ("critical","high"):
                top_issues.append({
                    "resident": rr.get("resident_name"),
                    "type": iss.get("type"),
                    "location": iss.get("location"),
                    "description": iss.get("description","")[:80],
                })
        if len(top_issues) >= MAX_ISSUES_FOR_LLM:
            break

    payload = {
        "total_residents_detected": aggregate.get("total_residents_detected"),
        "matched_residents":        aggregate.get("matched_residents"),
        "unmatched_residents":      aggregate.get("unmatched_residents"),
        "score":                    aggregate.get("score"),
        "grade":                    aggregate.get("grade"),
        "issue_summary":            aggregate.get("issue_summary"),
        "top_issues":               top_issues[:MAX_ISSUES_FOR_LLM],
    }
    compact = json.dumps(payload, ensure_ascii=False)[:5000]

    if settings.ANTHROPIC_API_KEY:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60)
            msg = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=1000,
                temperature=0.1,
                system=SYSTEM_PROMPT,
                messages=[{"role":"user","content":compact}],
            )
            if msg.stop_reason == "max_tokens":
                return _fallback(aggregate)
            parsed = _safe_parse(msg.content[0].text)
            return parsed if parsed else _fallback(aggregate)
        except Exception as e:
            logger.warning(f"Claude 요약 실패: {e}")

    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=60)
            resp = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role":"system","content":SYSTEM_PROMPT},
                    {"role":"user","content":compact},
                ],
                response_format={"type":"json_object"},
                temperature=0.1,
                max_tokens=800,
            )
            import json as _j
            return _j.loads(resp.choices[0].message.content or "{}")
        except Exception as e:
            logger.warning(f"OpenAI 요약 실패: {e}")

    return _fallback(aggregate)
