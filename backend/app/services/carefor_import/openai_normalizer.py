"""
OpenAI를 사용한 엑셀 컬럼 해석 + 데이터 정규화
역할: 엑셀 데이터를 표준 스키마로 변환 (검수 판단 아님)
"""
import json
import logging
import os
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

RESIDENT_SYSTEM = """당신은 한국 장기요양기관 케어포 엑셀 데이터 정규화 전문가입니다.

입력은 엑셀에서 추출한 행 데이터입니다.
컬럼명이 기관마다 다를 수 있으므로 의미를 해석해서 표준 스키마로 변환하세요.

반드시 JSON만 반환하세요 (마크다운 ``` 없이).
주민번호, 전화번호 원문은 반환하지 마세요.
날짜는 YYYY-MM-DD로 통일하세요.
장기요양등급은 "1등급","2등급","3등급","4등급","5등급","인지지원등급","등급외","미상" 중 하나로 정리하세요.
성별은 "남","여","미상" 중 하나로 정리하세요.
상태는 "active"(입소/재원/계약중), "discharged"(퇴소), "deceased"(사망), "unknown" 중 하나로 정리하세요.

중요:
아래 스키마에 없는 필드는 절대 반환하지 마세요.
특히 notes, memo, phone, resident_number, ssn, raw_name 같은 필드는 반환하지 마세요.

출력 형식:
{
  "rows": [
    {
      "resident_code": null,
      "name": "홍길동",
      "birth_date": "1940-01-01",
      "gender": "남",
      "care_grade": "3등급",
      "admission_date": "2026-06-01",
      "discharge_date": null,
      "room_name": "301호",
      "status": "active"
    }
  ],
  "warnings": []
}"""

LEAVE_SYSTEM = """당신은 한국 장기요양기관 케어포 외출·외박 기록 데이터 정규화 전문가입니다.

입력은 엑셀에서 추출한 행 데이터입니다.
컬럼명이 기관마다 다를 수 있으므로 의미를 해석해서 표준 스키마로 변환하세요.

반드시 JSON만 반환하세요 (마크다운 ``` 없이).
날짜는 YYYY-MM-DD, 시간은 HH:MM 형식으로 통일하세요.
leave_type은 "외출","외박","병원외출","기타" 중 하나로 정리하세요.
보호자명, 사유, 비고는 가능한 범위에서 정리하되 전화번호 등 개인정보는 제거하세요.

출력 형식:
{
  "rows": [
    {
      "resident_name": "홍길동",
      "resident_code": null,
      "leave_type": "병원외출",
      "start_date": "2026-06-10",
      "start_time": "09:00",
      "end_date": "2026-06-10",
      "end_time": "15:00",
      "reason": "외래진료",
      "guardian_name": "보호자명",
      "memo": null
    }
  ],
  "warnings": []
}"""


def _get_client():
    """OpenAI 클라이언트 반환"""
    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError("pip install openai")
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 미설정")
    return OpenAI(api_key=api_key, timeout=60)


def _call_openai(system: str, rows: List[Dict], model: str = "gpt-4o-mini") -> dict:
    """OpenAI 호출 — JSON mode 사용"""
    client = _get_client()
    user_msg = f"다음 {len(rows)}개 행을 표준 스키마로 변환하세요:\n{json.dumps(rows, ensure_ascii=False)}"
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=8192,
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(raw)


def _chunk(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def _extract_column_mapping(sample_rows: List[Dict], system: str) -> Dict[str, str]:
    """
    샘플 5행으로 컬럼 매핑만 추출
    이후 Python normalizer로 전체 처리에 활용
    """
    client = _get_client()
    cols = list(sample_rows[0].keys()) if sample_rows else []
    user_msg = (
        f"다음 컬럼명들의 의미를 파악해서 표준 필드명으로 매핑하세요.\n"
        f"컬럼명: {cols}\n"
        f"샘플 데이터: {json.dumps(sample_rows[:3], ensure_ascii=False)}\n\n"
        f"JSON으로 반환: {{\"mapping\": {{\"원본컬럼명\": \"표준필드명\"}}, \"unknown\": []}}"
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=8192,
    )
    result = json.loads(resp.choices[0].message.content or "{}")
    return result.get("mapping", {})


# ── 수급자 정보 정규화 ─────────────────────────────────────────────────────────
def normalize_residents_with_openai(raw_rows: List[Dict]) -> Dict:
    """
    OpenAI로 수급자 정보 정규화
    전략: 샘플 5행으로 컬럼 매핑 → 청크 50행씩 정규화
    """
    all_rows = []
    all_warnings = []

    try:
        # 전체 행이 적으면 한 번에 처리
        if len(raw_rows) <= 50:
            result = _call_openai(RESIDENT_SYSTEM, raw_rows)
            return {
                "rows":     result.get("rows", []),
                "warnings": result.get("warnings", []),
            }

        # 많으면 청크 처리
        for chunk in _chunk(raw_rows, 50):
            try:
                result = _call_openai(RESIDENT_SYSTEM, chunk)
                all_rows.extend(result.get("rows", []))
                all_warnings.extend(result.get("warnings", []))
            except Exception as e:
                logger.warning(f"청크 처리 실패 ({len(chunk)}행): {e}")
                all_warnings.append(f"청크 처리 실패: {str(e)[:80]}")

        return {"rows": all_rows, "warnings": all_warnings}

    except Exception as e:
        logger.warning(f"OpenAI normalizer 실패: {e}")
        return {"rows": [], "warnings": [str(e)], "openai_failed": True}


# ── 외출·외박 기록 정규화 ─────────────────────────────────────────────────────
def normalize_leave_records_with_openai(raw_rows: List[Dict]) -> Dict:
    """
    OpenAI로 외출·외박 기록 정규화
    """
    all_rows = []
    all_warnings = []

    try:
        if len(raw_rows) <= 50:
            result = _call_openai(LEAVE_SYSTEM, raw_rows)
            return {
                "rows":     result.get("rows", []),
                "warnings": result.get("warnings", []),
            }

        for chunk in _chunk(raw_rows, 50):
            try:
                result = _call_openai(LEAVE_SYSTEM, chunk)
                all_rows.extend(result.get("rows", []))
                all_warnings.extend(result.get("warnings", []))
            except Exception as e:
                logger.warning(f"청크 처리 실패: {e}")
                all_warnings.append(f"청크 처리 실패: {str(e)[:80]}")

        return {"rows": all_rows, "warnings": all_warnings}

    except Exception as e:
        logger.warning(f"OpenAI normalizer 실패: {e}")
        return {"rows": [], "warnings": [str(e)], "openai_failed": True}
