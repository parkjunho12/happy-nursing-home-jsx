import os
import json
import logging
from typing import Optional
from datetime import datetime

from app.schemas.ai import AIAnalysisResult, ContactAnalysisRequest
from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenAIClient:
    """OpenAI API 클라이언트"""
    
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # 기본값: gpt-4o-mini (비용 효율적)
        self.timeout = int(os.getenv("OPENAI_TIMEOUT", "30"))
        
        # OpenAI 클라이언트가 설치되어 있는지 확인
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key, timeout=self.timeout) if self.api_key else None
        except ImportError:
            logger.warning("OpenAI package not installed. AI analysis will be disabled.")
            self.client = None
    
    def _create_system_prompt(self) -> str:
        """시스템 프롬프트 생성"""
        return """당신은 요양원 상담 내용을 분석하는 전문 AI 어시스턴트입니다.

**중요 지침:**
1. 의료적 진단이나 법률적 확답은 절대 하지 마세요. 불확실한 경우 "추가 확인 필요"로 작성하세요.
2. 개인정보(이름, 연락처)는 요약에 반복하지 말고 최소한만 언급하세요.
3. 반드시 아래 JSON 형식으로만 응답하세요.

**응답 형식:**
{
  "summary": "2~3줄의 핵심 요약",
  "category": "입소 또는 요금 또는 면회 또는 의료간호 또는 프로그램 또는 기타 중 하나",
  "urgency": "HIGH 또는 MEDIUM 또는 LOW 중 하나",
  "next_actions": ["액션1", "액션2", ...],  // 최대 5개
  "red_flags": ["경고사항1", ...]  // 선택적, 긴급한 문제가 있을 경우만
}

**카테고리 가이드:**
- 입소: 입소 상담, 입소 절차, 입소 가능 여부
- 요금: 비용 문의, 보험 적용, 결제 방법
- 면회: 면회 시간, 면회 규정, 방문 예약
- 의료간호: 건강 상태, 의료 서비스, 간호 케어
- 프로그램: 활동 프로그램, 재활 프로그램
- 기타: 위에 해당하지 않는 문의

**긴급도 가이드:**
- HIGH: 즉시 대응 필요 (응급 상황, 심각한 불만, 중대한 문제)
- MEDIUM: 빠른 대응 필요 (일반 상담, 구체적 문의)
- LOW: 정보성 문의, 일반적인 질문

**Next Actions 예시:**
- "담당자 배정 후 24시간 내 회신"
- "시설 견학 일정 조율"
- "비용 상세 안내서 발송"
- "긴급 연락 후 상황 파악"
- "관련 부서 전달"
"""
    
    def _create_user_prompt(self, request: ContactAnalysisRequest) -> str:
        """사용자 프롬프트 생성"""
        return f"""다음 상담 내용을 분석해주세요:

**문의 유형:** {request.inquiry_type}
**문의 내용:**
{request.message}

위 내용을 분석하여 JSON 형식으로 응답해주세요."""
    
    def _get_fallback_result(self, request: ContactAnalysisRequest) -> AIAnalysisResult:
        """OpenAI 실패 시 폴백 결과"""
        return AIAnalysisResult(
            summary=f"{request.inquiry_type} 문의 - AI 분석 실패",
            category="기타",
            urgency="MEDIUM",
            next_actions=["담당자 확인 필요", "수동 분류 및 대응"],
            red_flags=None
        )
    
    async def analyze_contact_inquiry(
        self, 
        request: ContactAnalysisRequest
    ) -> Optional[AIAnalysisResult]:
        """
        상담 내용 분석
        
        Args:
            request: 상담 분석 요청
            
        Returns:
            AI 분석 결과 또는 None (API 키 없음/에러)
        """
        # API 키 없으면 None 반환
        if not self.api_key or not self.client:
            logger.warning("OpenAI API key not configured. Skipping AI analysis.")
            return None
        
        try:
            logger.info(f"Analyzing contact inquiry with OpenAI ({self.model})...")
            
            # OpenAI API 호출
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._create_system_prompt()},
                    {"role": "user", "content": self._create_user_prompt(request)}
                ],
                temperature=0.3,  # 일관성 있는 분석
                response_format={"type": "json_object"}  # JSON 모드 강제
            )
            
            # 응답 파싱
            content = response.choices[0].message.content
            logger.debug(f"OpenAI response: {content}")
            
            # JSON 파싱
            result_dict = json.loads(content)
            
            # Pydantic 모델로 변환 (검증)
            result = AIAnalysisResult(**result_dict)
            
            logger.info(f"AI analysis completed: category={result.category}, urgency={result.urgency}")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            return self._get_fallback_result(request)
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return self._get_fallback_result(request)


# 싱글톤 인스턴스
_openai_client: Optional[OpenAIClient] = None


def get_openai_client() -> OpenAIClient:
    """OpenAI 클라이언트 인스턴스 가져오기"""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client


async def analyze_contact_inquiry(request: ContactAnalysisRequest) -> Optional[AIAnalysisResult]:
    """
    상담 내용 분석 (편의 함수)
    
    Args:
        request: 상담 분석 요청
        
    Returns:
        AI 분석 결과 또는 None
    """
    client = get_openai_client()
    return await client.analyze_contact_inquiry(request)