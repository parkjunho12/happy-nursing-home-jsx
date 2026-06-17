"""
제공기록지 셀 값 정규화
"""
import re
from typing import Optional, Dict, Any


def norm_checkbox(val: Any) -> Optional[bool]:
    """■=True, □=False, 공란=None"""
    if val is None or str(val).strip() == '':
        return None
    s = str(val)
    if '■' in s: return True
    if '□' in s: return False
    return None


def norm_bathing(val: Any, next_val: Any = None) -> Dict:
    """
    목욕: ■/□ + 이전:정상/후:정상
    목욕 셀과 다음 셀(전:후: 정보)을 같이 받음
    """
    s = str(val or '').strip()
    provided = '■' in s
    before = after = None
    # 같은 셀에 전:후: 포함된 경우
    for text in [s, str(next_val or '')]:
        m = re.search(r'전[:\s]*(\S+)', text)
        if m: before = m.group(1)
        m = re.search(r'후[:\s]*(\S+)', text)
        if m: after = m.group(1)
    return {"provided": provided, "before_condition": before, "after_condition": after}


def norm_meal(val: Any) -> Dict:
    """
    식사: '일반식\n(1(정량))' → {meal_type, intake_amount}
    """
    s = str(val or '').strip().replace('\r', '')
    if not s:
        return {"meal_type": None, "intake_amount": None}
    # 줄바꿈으로 분리
    lines = [l.strip() for l in s.split('\n') if l.strip()]
    meal_type = lines[0] if lines else None
    intake    = None
    if len(lines) > 1:
        # "(1(정량))" → "1(정량)"
        raw = lines[1]
        raw = re.sub(r'^\(', '', raw)
        raw = re.sub(r'\)$', '', raw)
        intake = raw.strip()
    return {"meal_type": meal_type or None, "intake_amount": intake or None}


def norm_diaper(val: Any) -> Dict:
    """
    '대변1회/소변9회\n(기저귀 교환 7회)' → {bowel_count, urine_count, diaper_change_count}
    """
    s = str(val or '')
    bowel = urine = diaper = None
    m = re.search(r'대변\s*(\d+)', s)
    if m: bowel = int(m.group(1))
    m = re.search(r'소변\s*(\d+)', s)
    if m: urine = int(m.group(1))
    m = re.search(r'기저귀\s*교환\s*(\d+)', s)
    if m: diaper = int(m.group(1))
    return {"bowel_count": bowel, "urine_count": urine, "diaper_change_count": diaper}


def norm_walking(val: Any) -> Dict:
    """'■산책 / □외출' → {walking, outing}"""
    s = str(val or '')
    walking_m = re.search(r'([■□])\s*산책', s)
    outing_m  = re.search(r'([■□])\s*외출', s)
    return {
        "walking": walking_m.group(1) == '■' if walking_m else None,
        "outing":  outing_m.group(1)  == '■' if outing_m  else None,
    }


def norm_vital(val: Any) -> Dict:
    """'135-79 / 36.9' → {systolic, diastolic, temperature}"""
    s = str(val or '').strip()
    if not s:
        return {"systolic": None, "diastolic": None, "temperature": None}
    m = re.search(r'(\d+)\s*[-–]\s*(\d+)\s*/\s*([\d.]+)', s)
    if m:
        return {
            "systolic":    int(m.group(1)),
            "diastolic":   int(m.group(2)),
            "temperature": float(m.group(3)),
        }
    return {"systolic": None, "diastolic": None, "temperature": None}


def norm_condition(val: Any) -> Dict:
    """수급자 상태 행 파싱"""
    s = str(val or '')
    def checked(keyword): return bool(re.search(rf'■\s*{keyword}', s))
    mobility = None
    if checked('자립'):    mobility = '자립'
    elif checked('준와상'): mobility = '준와상'
    elif checked('와상'):   mobility = '와상'
    return {
        "mobility":   mobility,
        "dementia":   checked('치매'),
        "stroke":     checked('중풍'),
        "hypertension": checked('고혈압'),
        "diabetes":   checked('당뇨'),
        "arthritis":  checked('관절염'),
        "other_disease": re.search(r'기타\s*\(\s*([^)]+)\)', s).group(1).strip()
                         if re.search(r'기타\s*\(\s*([^)]+)\)', s) else None,
    }


def norm_equipment(val: Any) -> Dict:
    """처치/보조도구 행 파싱"""
    s = str(val or '')
    def checked(kw): return bool(re.search(rf'■\s*{kw}', s))
    return {
        "tracheostomy": checked('기관지절개관'),
        "denture":      checked('틀니'),
        "nasogastric":  checked('비위관'),
        "catheter":     checked('유치도뇨관'),
        "diaper":       checked('기저귀'),
        "bedsore":      checked('욕창'),
    }


def clean_text(val: Any) -> Optional[str]:
    if val is None: return None
    s = str(val).strip()
    return s if s and s not in ('□', '■') else None
