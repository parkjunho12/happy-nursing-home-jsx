"""
케어포 데이터 정규화
- fuzzy column mapping
- 날짜 형식 통일
- 개인정보 마스킹 (주민번호, 전화번호)
"""
import re
from datetime import datetime
from typing import Any, Dict, Optional, List


# ── 컬럼명 fuzzy mapping ────────────────────────────────────────────────────────
RESIDENT_COL_MAP = {
    "name":          ["수급자명","성명","이름","어르신명","수급자","name"],
    "resident_code": ["수급자코드","코드","code","수급번호","번호"],
    "birth_date":    ["생년월일","birth","생년","출생일"],
    "gender":        ["성별","gender","sex"],
    "care_grade":    ["장기요양등급","등급","요양등급","grade","care_grade"],
    "admission_date":["입소일","입소날짜","입원일","admission","입소"],
    "discharge_date":["퇴소일","퇴소날짜","퇴원일","discharge","퇴소"],
    "room_name":     ["생활실","호실","room","방","객실"],
    "status":        ["상태","status"],
}

LEAVE_COL_MAP = {
    "resident_name": ["수급자명","성명","이름","어르신명","수급자","name"],
    "resident_code": ["수급자코드","코드","code","수급번호"],
    "leave_type":    ["구분","외출구분","외박구분","유형","type","leave_type"],
    "start_date":    ["외출일","외박일","시작일","출발일","start_date","외출시작일","시작"],
    "start_time":    ["출발시간","시작시간","start_time","외출시간"],
    "end_date":      ["귀원일","복귀일","종료일","return_date","end_date","외출종료일","종료"],
    "end_time":      ["귀원시간","복귀시간","return_time","end_time"],
    "reason":        ["사유","이유","reason"],
    "guardian_name": ["보호자","보호자명","guardian"],
    "memo":          ["비고","메모","memo","특이사항"],
    "leave_days":    ["외박일수","외출일수","일수","박수","days"],
}


def _find_col(row: Dict[str, Any], candidates: List[str]) -> Optional[Any]:
    """row 딕셔너리에서 후보 컬럼명과 fuzzy 매칭해서 값 반환"""
    row_keys_lower = {k.strip().lower(): k for k in row}
    for cand in candidates:
        key = cand.lower()
        if key in row_keys_lower:
            v = row[row_keys_lower[key]]
            if v is not None and str(v).strip():
                return str(v).strip()
    # 부분 매칭
    for cand in candidates:
        for rk, orig_k in row_keys_lower.items():
            if cand.lower() in rk or rk in cand.lower():
                v = row[orig_k]
                if v is not None and str(v).strip():
                    return str(v).strip()
    return None


def _normalize_date(val: Any) -> Optional[str]:
    """다양한 날짜 형식을 YYYY-MM-DD로 통일"""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in ('None', 'nan', ''):
        return None

    # YYYY-MM-DD (뒤에 시간이 붙어 있어도 앞 10자리 사용)
    if re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return s[:10]

    # YYYY.MM.DD / YYYY/MM/DD
    m = re.match(r'^(\d{4})[./](\d{1,2})[./](\d{1,2})$', s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"

    # YYYYMMDD
    if re.match(r'^\d{8}$', s):
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"

    # 엑셀 날짜 serial (숫자)
    try:
        serial = float(s)
        if 10000 < serial < 100000:
            from datetime import date
            origin = date(1899, 12, 30)
            from datetime import timedelta
            d = origin + timedelta(days=int(serial))
            return d.strftime('%Y-%m-%d')
    except (ValueError, OverflowError):
        pass

    # datetime 객체 문자열
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%Y.%m.%d %H:%M:%S'):
        try:
            return datetime.strptime(s[:10], fmt[:8]).strftime('%Y-%m-%d')
        except ValueError:
            pass

    # 문자열 어딘가에 박힌 날짜 추출 (예: '외박중 퇴소(2026.06.07 14:50)')
    m = re.search(r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})', s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"

    return None


def _normalize_time(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    # 맨 앞이 HH:MM 형식일 때만 시간으로 인정 (날짜·텍스트 섞인 셀은 무시)
    m = re.match(r'^(\d{1,2}):(\d{2})', s)
    if m:
        return f"{m.group(1).zfill(2)}:{m.group(2)}"
    return None


def _mask_pii(raw: Dict[str, Any]) -> Dict[str, Any]:
    """주민번호, 전화번호 마스킹"""
    masked = {}
    for k, v in raw.items():
        if v is None:
            masked[k] = v
            continue
        s = str(v)
        s = re.sub(r'\d{6}[-–]\d{7}', '[주민번호]', s)
        s = re.sub(r'0\d{1,2}[-–.]?\d{3,4}[-–.]?\d{4}', '[전화번호]', s)
        masked[k] = s
    return masked


def _extract_birth_from_rrn(rrn: str) -> Optional[str]:
    """주민번호 앞 6자리에서 생년월일 추출"""
    m = re.match(r'^(\d{6})', rrn.replace('-', ''))
    if not m:
        return None
    front = m.group(1)
    yy, mm, dd = front[:2], front[2:4], front[4:6]
    # 뒷자리 첫 숫자로 세기 판단 (없으면 2000년대로 가정 후 현재 기준)
    year = f"19{yy}" if int(yy) > 25 else f"20{yy}"
    return f"{year}-{mm}-{dd}"


# ── 수급자 정규화 ───────────────────────────────────────────────────────────────
def normalize_resident(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    name = _find_col(row, RESIDENT_COL_MAP["name"])
    if not name:
        return None  # 이름 없으면 스킵

    # 주민번호 처리: 생년월일 추출 후 raw_data에서 제거
    birth = _find_col(row, RESIDENT_COL_MAP["birth_date"])
    rrn_keys = [k for k in row if '주민' in k or 'rrn' in k.lower() or '등록' in k]
    if not birth and rrn_keys:
        rrn_val = str(row.get(rrn_keys[0], '') or '')
        if re.match(r'\d{6}[-–]\d{7}', rrn_val):
            birth = _extract_birth_from_rrn(rrn_val)

    discharge_date = _normalize_date(_find_col(row, RESIDENT_COL_MAP["discharge_date"]))
    status_raw = _find_col(row, RESIDENT_COL_MAP["status"]) or ""
    # 상태 정규화 — 퇴소일이 있으면 퇴소(inactive) 처리 (규칙 6: discharged=true)
    if any(w in status_raw for w in ['사망', 'death']):
        status = "deceased"
    elif discharge_date or any(w in status_raw for w in ['퇴소', '퇴원', '종료', 'inactive']):
        status = "inactive"
    else:
        status = "active"

    return {
        "resident_code":  _find_col(row, RESIDENT_COL_MAP["resident_code"]),
        "name":           name,
        "birth_date":     _normalize_date(birth),
        "gender":         _find_col(row, RESIDENT_COL_MAP["gender"]),
        "care_grade":     _find_col(row, RESIDENT_COL_MAP["care_grade"]),  # '등급외'도 그대로 보존
        "admission_date": _normalize_date(_find_col(row, RESIDENT_COL_MAP["admission_date"])),
        "discharge_date": discharge_date,
        "room_name":      _find_col(row, RESIDENT_COL_MAP["room_name"]),
        "status":         status,
        "raw_data":       _mask_pii(row),  # 개인정보 마스킹 후 저장
    }


# ── 외박/외출 정규화 ────────────────────────────────────────────────────────────
def normalize_leave(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    name = _find_col(row, LEAVE_COL_MAP["resident_name"])
    if not name:
        return None

    leave_type_raw = _find_col(row, LEAVE_COL_MAP["leave_type"]) or ""
    if '병원' in leave_type_raw:
        leave_type = "병원외출"
    elif '외박' in leave_type_raw:
        leave_type = "외박"
    elif '외출' in leave_type_raw:
        leave_type = "외출"
    else:
        leave_type = leave_type_raw or "외출"

    start_date = _normalize_date(_find_col(row, LEAVE_COL_MAP["start_date"]))
    end_date   = _normalize_date(_find_col(row, LEAVE_COL_MAP["end_date"]))

    # 외박일수로 한쪽 날짜 보완 (예: '외박중 퇴소' → 시작일 비고 종료일+일수만 있을 때)
    days = None
    days_raw = _find_col(row, LEAVE_COL_MAP["leave_days"])
    if days_raw:
        dm = re.search(r'(\d+)', str(days_raw))
        if dm:
            days = int(dm.group(1))
    if days:
        from datetime import date as _date, timedelta as _td
        try:
            if start_date and not end_date:
                end_date = (_date.fromisoformat(start_date) + _td(days=days)).isoformat()
            elif end_date and not start_date:
                start_date = (_date.fromisoformat(end_date) - _td(days=days)).isoformat()
        except Exception:
            pass

    return {
        "resident_name": name,
        "resident_code": _find_col(row, LEAVE_COL_MAP["resident_code"]),
        "leave_type":    leave_type,
        "start_date":    start_date,
        "start_time":    _normalize_time(_find_col(row, LEAVE_COL_MAP["start_time"])),
        "end_date":      end_date,
        "end_time":      _normalize_time(_find_col(row, LEAVE_COL_MAP["end_time"])),
        "reason":        _find_col(row, LEAVE_COL_MAP["reason"]),
        "guardian_name": _find_col(row, LEAVE_COL_MAP["guardian_name"]),
        "memo":          _find_col(row, LEAVE_COL_MAP["memo"]),
        "raw_data":      _mask_pii(row),
    }
