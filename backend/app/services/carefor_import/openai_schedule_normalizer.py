"""
근무표 OpenAI 정규화 + Python rule-based fallback
OpenAI 역할: 표 구조 해석 + 근무코드 변환 (검수 판단 아님)
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── 서버 최종 정규화 맵 (OpenAI 결과 덮어쓰기용) ─────────────────────────────
SHIFT_MAP: Dict[str, Dict] = {
    "D":    {"label": "주간",   "start": "09:00", "end": "18:00", "is_working": True},
    "주":   {"label": "주간",   "start": "09:00", "end": "18:00", "is_working": True},
    "주간": {"label": "주간",   "start": "09:00", "end": "18:00", "is_working": True},
    "N":    {"label": "야간",   "start": "18:00", "end": "09:00", "is_working": True},
    "야":   {"label": "야간",   "start": "18:00", "end": "09:00", "is_working": True},
    "야간": {"label": "야간",   "start": "18:00", "end": "09:00", "is_working": True},
    "E":    {"label": "이브닝", "start": "13:00", "end": "22:00", "is_working": True},
    "이브닝":{"label": "이브닝","start": "13:00", "end": "22:00", "is_working": True},
    "휴":   {"label": "휴무",   "start": None,     "end": None,    "is_working": False},
    "휴무": {"label": "휴무",   "start": None,     "end": None,    "is_working": False},
    "OFF":  {"label": "휴무",   "start": None,     "end": None,    "is_working": False},
    "연차": {"label": "연차",   "start": None,     "end": None,    "is_working": False},
    "대휴": {"label": "대휴",   "start": None,     "end": None,    "is_working": False},
    "공가": {"label": "공가",   "start": None,     "end": None,    "is_working": False},
    "병가": {"label": "병가",   "start": None,     "end": None,    "is_working": False},
}

SCHEDULE_SYSTEM = """당신은 한국 요양원 근무표 엑셀 데이터 정규화 전문가입니다.

입력은 엑셀에서 추출한 행 데이터입니다.
근무표는 두 형태 중 하나입니다:
1. 행=직원, 열=날짜 (예: 이름|1일|2일|3일...)
2. 행=날짜별 기록 (예: 날짜|직원명|근무종류|시작|종료)

반드시 JSON만 반환하세요 (마크다운 ``` 없이).
날짜는 YYYY-MM-DD, 시간은 HH:MM 형식으로 반환하세요.

근무코드 기본 해석:
D, 주, 주간 → shift_code="D", shift_label="주간", start_time="09:00", end_time="18:00", is_working=true
N, 야, 야간 → shift_code="N", shift_label="야간", start_time="18:00", end_time="09:00", is_working=true
E, 이브닝   → shift_code="E", shift_label="이브닝", start_time="13:00", end_time="22:00", is_working=true
휴, 휴무, OFF, 연차, 대휴, 공가 → is_working=false

출력 형식:
{
  "rows": [
    {
      "staff_name": "김OO",
      "work_date": "2026-06-01",
      "shift_code": "D",
      "shift_label": "주간",
      "start_time": "09:00",
      "end_time": "18:00",
      "is_working": true
    }
  ],
  "warnings": [],
  "detected_format": "A또는B"
}"""

# ── OpenAI 호출 ───────────────────────────────────────────────────────────────
def _call_openai(rows: List[Dict], year: Optional[int], month: Optional[int]) -> dict:
    import os
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=60)
    ym_hint = f"\n연도: {year}, 월: {month}" if year and month else ""
    user_msg = f"다음 근무표 데이터를 표준 스키마로 변환하세요.{ym_hint}\n{json.dumps(rows, ensure_ascii=False)}"
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SCHEDULE_SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=8192,   # 행 수에 비례해서 충분히 확보
    )
    # 잘림 감지
    finish = resp.choices[0].finish_reason
    if finish == "length":
        raise ValueError(f"OpenAI max_tokens 도달 — 청크를 더 작게 나누세요 ({len(rows)}행)")
    return json.loads(resp.choices[0].message.content or "{}")


def _chunk(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


# ── 서버 측 shift 정규화 (OpenAI 결과 덮어쓰기) ──────────────────────────────
def _apply_shift_map(row: dict) -> dict:
    code = (row.get("shift_code") or "").strip()
    if code in SHIFT_MAP:
        m = SHIFT_MAP[code]
        row["shift_label"] = m["label"]
        row["is_working"]  = m["is_working"]
        # 시작/종료가 없을 때만 기본값 적용 (직접 입력 시간 우선)
        if not row.get("start_time"): row["start_time"] = m["start"]
        if not row.get("end_time"):   row["end_time"]   = m["end"]
    return row


# ── Python Rule-based fallback ────────────────────────────────────────────────
def _detect_format(rows: List[Dict]) -> str:
    """A형(열=날짜) vs B형(행=날짜) 감지"""
    if not rows:
        return "B"
    keys = list(rows[0].keys())
    # 날짜 숫자 컬럼(1~31)이 많으면 A형
    date_cols = [k for k in keys if str(k).strip().isdigit() and 1 <= int(str(k).strip()) <= 31]
    return "A" if len(date_cols) >= 5 else "B"


def _normalize_date(val: Any, year: Optional[int], month: Optional[int]) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        return s
    m = re.match(r'^(\d{1,2})[/.](\d{1,2})$', s)
    if m and year and month:
        return f"{year}-{month:02d}-{int(m.group(1)):02d}"
    if s.isdigit() and 1 <= int(s) <= 31 and year and month:
        return f"{year}-{month:02d}-{int(s):02d}"
    return None


def _rule_based_normalize(
    raw_rows: List[Dict],
    year: Optional[int],
    month: Optional[int],
) -> List[Dict]:
    fmt = _detect_format(raw_rows)
    results = []

    if fmt == "A":  # 행=직원, 열=날짜
        name_keys = ["이름","성명","직원명","staff_name","name","직원","성함"]
        for row in raw_rows:
            staff_name = None
            for k in name_keys:
                if k in row and row[k]:
                    staff_name = str(row[k]).strip()
                    break
            if not staff_name:
                # 첫 번째 비숫자 컬럼을 이름으로
                for k, v in row.items():
                    if not str(k).isdigit() and v:
                        staff_name = str(v).strip()
                        break
            if not staff_name:
                continue
            for k, v in row.items():
                day_s = str(k).strip()
                if not day_s.isdigit():
                    continue
                d = int(day_s)
                if not (1 <= d <= 31):
                    continue
                if year and month:
                    work_date = f"{year}-{month:02d}-{d:02d}"
                else:
                    continue
                code = str(v).strip() if v else ""
                rec = {"staff_name": staff_name, "work_date": work_date, "shift_code": code}
                results.append(_apply_shift_map(rec))

    else:  # B형: 행=날짜별 기록
        name_keys  = ["직원명","이름","성명","staff_name","name"]
        date_keys  = ["날짜","work_date","date","일자"]
        shift_keys = ["근무","근무코드","shift","구분","근무종류"]
        st_keys    = ["시작","시작시간","start","출근"]
        et_keys    = ["종료","종료시간","end","퇴근"]

        def _get(row, candidates):
            for k in candidates:
                if k in row and row[k] is not None:
                    return str(row[k]).strip()
            return None

        for row in raw_rows:
            staff_name = _get(row, name_keys)
            date_raw   = _get(row, date_keys)
            shift_raw  = _get(row, shift_keys)
            if not staff_name or not date_raw:
                continue
            work_date = _normalize_date(date_raw, year, month)
            if not work_date:
                continue
            rec = {
                "staff_name": staff_name,
                "work_date":  work_date,
                "shift_code": shift_raw or "",
                "start_time": _get(row, st_keys),
                "end_time":   _get(row, et_keys),
            }
            results.append(_apply_shift_map(rec))

    return results


# ── 메인 함수 ─────────────────────────────────────────────────────────────────
def normalize_work_schedule_with_openai(
    raw_rows: List[Dict],
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> Dict:
    all_rows: List[Dict] = []
    all_warnings: List[str] = []

    try:
        import os
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY 미설정")

        CHUNK_SIZE = 20   # 행=직원, 열=날짜 형태는 1행당 출력이 많아 작게 유지

        for chunk in _chunk(raw_rows, CHUNK_SIZE):
            try:
                result = _call_openai(chunk, year, month)
                raw = result.get("rows", [])
                normalized = [_apply_shift_map(r) for r in raw]
                all_rows.extend(normalized)
                all_warnings.extend(result.get("warnings", []))
            except ValueError as ve:
                # max_tokens 도달 → 청크를 절반으로 줄여 재시도
                logger.warning(f"청크 크기 초과 → 절반으로 재시도: {ve}")
                half = CHUNK_SIZE // 2
                for mini_chunk in _chunk(chunk, half):
                    try:
                        result = _call_openai(mini_chunk, year, month)
                        raw = result.get("rows", [])
                        all_rows.extend([_apply_shift_map(r) for r in raw])
                        all_warnings.extend(result.get("warnings", []))
                    except Exception as e2:
                        logger.warning(f"미니 청크 실패 → rule-based: {e2}")
                        fb = _rule_based_normalize(mini_chunk, year, month)
                        all_rows.extend(fb)
                        all_warnings.append(f"미니 청크 fallback: {str(e2)[:60]}")
            except Exception as e:
                logger.warning(f"청크 OpenAI 실패: {e}")
                fb = _rule_based_normalize(chunk, year, month)
                all_rows.extend(fb)
                all_warnings.append(f"청크 fallback 사용: {str(e)[:60]}")

        return {"rows": all_rows, "warnings": all_warnings, "openai_used": True}

    except Exception as e:
        logger.warning(f"OpenAI 전체 실패 → rule-based fallback: {e}")
        fb = _rule_based_normalize(raw_rows, year, month)
        return {
            "rows":        fb,
            "warnings":    [f"OpenAI 미사용 (rule-based): {str(e)[:80]}"],
            "openai_used": False,
        }
