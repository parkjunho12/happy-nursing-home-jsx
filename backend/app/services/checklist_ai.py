"""
체크리스트 AI 검토 서비스
- app/services/openai.py의 OpenAIClient 패턴을 재사용
- 평가 가이드라인(.md) + 현재 체크리스트 현황을 입력으로 받아
  AI가 보완점/누락항목/개선의견을 JSON으로 반환
"""
import os
import json
import logging
from typing import Optional, List

from app.core.config import settings
from app.schemas.eval_ai import AIReviewResult

logger = logging.getLogger(__name__)

MAX_GUIDELINE_CHARS = 12000   # 가이드라인 본문 토큰 절약을 위한 컷
MAX_CHECKLIST_ITEMS = 200     # 너무 많으면 컷


class ChecklistAIReviewClient:
    """평가 가이드라인 기반 체크리스트 AI 검토 클라이언트"""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = os.getenv("OPENAI_REVIEW_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
        self.timeout = int(os.getenv("OPENAI_TIMEOUT", "60"))

        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key, timeout=self.timeout) if self.api_key else None
        except ImportError:
            logger.warning("OpenAI package not installed. AI review will be disabled.")
            self.client = None

    # ── 프롬프트 ──────────────────────────────────────────────────────

    def _create_system_prompt(self) -> str:
        return """당신은 한국 장기요양기관(노인요양시설) 평가 컨설턴트입니다.
시설이 제공한 "평가 가이드라인(평가 매뉴얼/지표 기준)"과 "현재 운영 중인 체크리스트 목록 및 완료 현황"을
비교 분석하여, 다가오는 기관 평가를 대비해 보완이 필요한 점을 구체적으로 짚어주는 역할을 합니다.

**중요 지침:**
1. 가이드라인에 명시된 주기(매일/매주/매월/분기/반기/연)와 현재 체크리스트의 주기가 일치하는지 확인하세요.
2. 가이드라인에서 요구하는 증빙자료(서명부, 기록지, 사진 등)가 체크리스트의 evidence_required에 충분히 반영되어 있는지 확인하세요.
3. 현재 미완료 상태이거나 완료 이력이 부족한 항목 중 감점 위험이 큰 항목을 우선적으로 짚어주세요.
4. 가이드라인에는 있지만 체크리스트 목록에 전혀 대응 항목이 없는 경우 "missing_items"로 제안하세요.
5. 의료적 진단이나 법률적 확답은 하지 마세요. 평가 준비 관점의 실무적 제안만 하세요.
6. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트, 마크다운 코드블록(```)을 포함하지 마세요.

**응답 형식 (JSON):**
{
  "overall_score": 0~100 사이의 정수 (현재 체크리스트 체계가 가이드라인을 얼마나 충족하는지 종합 점수),
  "summary": "전체 평가 요약 (3~5문장)",
  "strengths": ["잘 갖춰진 점1", "잘 갖춰진 점2", ...],
  "findings": [
    {
      "checklist_id": "해당 체크리스트의 id (제공된 목록에서 정확히 일치하는 id를 사용, 없으면 null)",
      "title": "체크리스트 제목 또는 관련 항목명",
      "issue": "구체적인 문제점/리스크 설명",
      "severity": "high 또는 medium 또는 low",
      "recommendation": "구체적인 개선 제안 (어떻게 수정해야 하는지)"
    }
  ],
  "missing_items": [
    {
      "indicator_name": "관련 세부지표/평가항목명",
      "description": "가이드라인 상 요구되지만 현재 체크리스트에 없는 내용 설명",
      "suggested_title": "새로 추가할 체크리스트 제목 제안",
      "suggested_frequency": "daily 또는 weekly 또는 monthly 또는 quarterly 또는 half-yearly 또는 yearly 중 하나",
      "severity": "high 또는 medium 또는 low"
    }
  ],
  "compliance_notes": ["평가 준비 관점에서의 종합 의견 1", "종합 의견 2", ...]
}

findings와 missing_items는 각각 최대 10개까지만 포함하세요. 중요도가 높은 순서로 정렬하세요.
"""

    def _create_user_prompt(self, guideline_content: str, checklist_summary: str, domain_name: Optional[str]) -> str:
        scope = f"\n\n**검토 범위:** '{domain_name}' 평가영역에 해당하는 항목 위주로 검토해주세요." if domain_name else ""

        return f"""다음은 우리 시설의 평가 가이드라인 문서입니다:

--- 평가 가이드라인 시작 ---
{guideline_content}
--- 평가 가이드라인 끝 ---

다음은 현재 운영 중인 체크리스트 목록 및 완료 현황입니다 (JSON):

--- 체크리스트 현황 시작 ---
{checklist_summary}
--- 체크리스트 현황 끝 ---
{scope}

위 가이드라인 기준으로 현재 체크리스트 체계를 검토하고, 지정된 JSON 형식으로 응답해주세요."""

    # ── 폴백 ──────────────────────────────────────────────────────────

    def _fallback_result(self, reason: str) -> AIReviewResult:
        return AIReviewResult(
            overall_score=0,
            summary=f"AI 검토를 완료하지 못했습니다 ({reason}). OPENAI_API_KEY 설정을 확인하거나 잠시 후 다시 시도해주세요.",
            strengths=[],
            findings=[],
            missing_items=[],
            compliance_notes=[],
        )

    # ── 메인 진입점 ───────────────────────────────────────────────────

    async def review(
        self,
        guideline_content: str,
        checklist_items: List[dict],
        domain_name: Optional[str] = None,
    ) -> AIReviewResult:
        if not self.api_key or not self.client:
            logger.warning("OpenAI API key not configured. Skipping AI review.")
            return self._fallback_result("API 키 미설정")

        # 입력 데이터 정리 (토큰 절약)
        trimmed_guideline = guideline_content[:MAX_GUIDELINE_CHARS]
        trimmed_items = checklist_items[:MAX_CHECKLIST_ITEMS]
        checklist_summary = json.dumps(trimmed_items, ensure_ascii=False)

        try:
            logger.info(f"Running checklist AI review with OpenAI ({self.model})...")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._create_system_prompt()},
                    {"role": "user", "content": self._create_user_prompt(trimmed_guideline, checklist_summary, domain_name)},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            logger.debug(f"AI review raw response: {content}")

            result_dict = json.loads(content)
            return AIReviewResult(**result_dict)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI review response as JSON: {e}")
            return self._fallback_result("응답 형식 오류")
        except Exception as e:
            logger.error(f"AI review error: {e}")
            return self._fallback_result("API 호출 오류")


_client: Optional[ChecklistAIReviewClient] = None


def get_checklist_ai_client() -> ChecklistAIReviewClient:
    global _client
    if _client is None:
        _client = ChecklistAIReviewClient()
    return _client
