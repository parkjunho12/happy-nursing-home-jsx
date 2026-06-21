"""
수급자별 Rule Engine — DailyCareRecord 기반
더 이상 record_text 전체 문자열에 의존하지 않음
"""
import logging
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

Issue = Dict[str, str]
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _parse_date(s: Any) -> Optional[date]:
    if not s: return None
    for fmt in ('%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d'):
        try: return datetime.strptime(str(s)[:10], fmt).date()
        except ValueError: pass
    return None


def _parse_time_min(s: Any) -> Optional[int]:
    """'HH:MM' / 'H:MM' / 'HHMM' → 자정 기준 분. 파싱 실패 시 None"""
    if not s:
        return None
    txt = str(s).strip()
    import re as _re
    m = _re.search(r'(\d{1,2})\s*[:시]\s*(\d{1,2})', txt)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
    else:
        digits = _re.sub(r'\D', '', txt)
        if len(digits) == 4:
            h, mi = int(digits[:2]), int(digits[2:])
        elif len(digits) in (1, 2):
            h, mi = int(digits), 0
        else:
            return None
    if 0 <= h <= 23 and 0 <= mi <= 59:
        return h * 60 + mi
    return None


# 식사 시간 (분): 아침 07:30, 점심 11:30, 저녁 16:30
MEAL_TIMES = [
    ("아침", 7 * 60 + 30, "breakfast"),
    ("점심", 11 * 60 + 30, "lunch"),
    ("저녁", 16 * 60 + 30, "dinner"),
]


def audit_daily_records(
    records:   List[Any],          # List[DailyCareRecord]
    resident:  Optional[Dict],     # carefor_residents DB row
    leaves:    List[Dict],         # 해당 수급자 외박/외출
    schedules: List[Dict],         # 근무표 전체
) -> List[Issue]:
    """
    DailyCareRecord[] 기반 검수
    - 각 날짜별 모든 항목을 구조화된 데이터로 확인
    - 텍스트 파싱 없음
    """
    issues: List[Issue] = []

    adm    = _parse_date(resident.get('admission_date') if resident else None)
    dis    = _parse_date(resident.get('discharge_date') if resident else None)
    status = resident.get('status', 'active') if resident else 'active'

    # 근무표 인덱스
    sched_idx: Dict[str, Dict[str, Dict]] = {}
    for sc in schedules:
        d, nm = sc.get('work_date', ''), sc.get('staff_name', '')
        if d and nm:
            sched_idx.setdefault(d, {})[nm] = sc

    # 외박/외출 기간 분류
    #  - 외박(밤샘): 해당 날짜 검사 전체 제외 (공란이 정상)
    #  - 외출(낮):  식사시간과 외출시간을 비교 (겹치는 식사만 공란 허용, 제공 시 경고)
    overnight_periods = []   # [(sd, ed)]
    outings = []             # [{sd, ed, ltype, st_min, et_min, start_str, end_str}]
    for l in leaves:
        sd = _parse_date(l.get('start_date'))
        ed = _parse_date(l.get('end_date'))
        if not sd:
            continue
        ed = ed or sd
        ltype = l.get('leave_type', '') or ''
        # 외박 판정: 타입에 '외박' 포함하거나, 날짜가 1박 이상 걸쳐 있으면 외박으로 간주
        is_overnight = ('외박' in ltype) or (ed > sd)
        if is_overnight:
            overnight_periods.append((sd, ed))
        else:
            start_str = l.get('start_time') or ''
            end_str   = l.get('end_time') or ''
            outings.append({
                'sd': sd, 'ed': ed, 'ltype': ltype or '외출',
                'st_min': _parse_time_min(start_str),
                'et_min': _parse_time_min(end_str),
                'start_str': start_str, 'end_str': end_str,
            })

    # 목욕 날짜 수집 (입소일 이후만)
    bathing_dates = [
        r.service_date for r in records
        if r.physical.get('bathing', {}).get('provided')
        and (not adm or (_parse_date(r.service_date) or date.min) >= adm)
    ]

    # 입소일 이후 기록 수 (목욕 기준일수 판단용)
    valid_records = [
        r for r in records
        if not adm or (_parse_date(r.service_date) or date.min) >= adm
    ]

    # 외박(밤샘) 날짜는 요약 판정에서도 제외 (검수 대상 아님)
    def _is_overnight_date(d):
        return bool(d) and any(sd <= d <= ed for sd, ed in overnight_periods)
    present_records = [
        r for r in valid_records
        if not _is_overnight_date(_parse_date(r.service_date))
    ]

    # 식사/산책/배변 요약 판정용
    meal_missing_days = []   # [(date_short, [끼니명...])]
    _mobility = None
    for _r in records:
        _mm = _r.condition.get('mobility') if isinstance(_r.condition, dict) else None
        if _mm:
            _mobility = _mm
            break
    is_bedridden = _mobility in ('와상', '준와상')

    for rec in records:
        date_str   = rec.service_date
        rec_date   = _parse_date(date_str)
        date_short = date_str[5:] if len(date_str) >= 7 else date_str
        sheet      = rec.source_sheet
        name       = rec.resident_name or ''
        loc_prefix = f"[{sheet}] {date_short} / {name}"

        if not rec_date:
            continue

        # ── 입소일 이전 날짜는 검증 전체 스킵 (공란이 정상) ────────────────
        if adm and rec_date < adm:
            continue

        # ── 외박(밤샘) 날짜는 검사 전체 제외 (공란이 정상) ──────────────────
        if any(sd <= rec_date <= ed for sd, ed in overnight_periods):
            continue

        # ── 퇴소 후 기록 ────────────────────────────────────────────────────
        if dis and rec_date > dis:
            issues.append({"type":"퇴소후기록","severity":"high",
                "location": loc_prefix,
                "description": f"퇴소일({dis}) 이후 날짜({date_short})에 제공기록이 있습니다.",
                "suggestion": "퇴소 이후 기록을 확인하세요."})

        # ── 사망 후 기록 ────────────────────────────────────────────────────
        if status == 'deceased':
            issues.append({"type":"사망후기록","severity":"critical",
                "location": loc_prefix,
                "description": "사망 처리된 수급자의 제공기록이 존재합니다.",
                "suggestion": "즉시 원장에게 보고하세요."})

        # ── 외출(낮) 시간대 식사 제공 여부 ──────────────────────────────────
        #  외출 시간에 걸치는 식사는 공란이 정상.
        #  그 식사가 '제공됨'으로 기록돼 있으면 외출 사실과 상충 → 경고.
        for o in outings:
            if not (o['sd'] <= rec_date <= o['ed']):
                continue
            st, et = o['st_min'], o['et_min']
            if st is None or et is None:
                # 외출 시간 정보가 없으면 식사시간과 비교 불가 → 경고 보류
                continue
            if et < st:
                st, et = et, st
            tspan = f"{o['start_str']}~{o['end_str']}" if (o['start_str'] or o['end_str']) else ""
            for meal_name, meal_min, meal_key in MEAL_TIMES:
                if not (st <= meal_min <= et):
                    continue
                mv = rec.physical.get(meal_key) or {}
                provided = bool(mv.get('meal_type') or mv.get('intake_amount'))
                if provided:
                    issues.append({"type":"외출중식사제공","severity":"medium",
                        "location": f"{loc_prefix} ({o['ltype']} {tspan})".rstrip(),
                        "description": f"{o['ltype']} 시간({tspan})에 해당하는 {meal_name} 식사가 '제공됨'으로 기록되어 있습니다.",
                        "suggestion": "외출 시간과 식사 제공 기록이 상충합니다. 실제 제공 여부를 확인하세요."})

        # ── 식사 미기록 누적 (외출 겹치는 끼니는 정상, 시간없는 외출일은 보류) ──
        _day_outings = [o for o in outings if o['sd'] <= rec_date <= o['ed']]
        _skip_meal = any((o['st_min'] is None or o['et_min'] is None) for o in _day_outings)
        if not _skip_meal:
            _missing = []
            for meal_name, meal_min, meal_key in MEAL_TIMES:
                mv = rec.physical.get(meal_key) or {}
                if mv.get('meal_type') or mv.get('intake_amount'):
                    continue
                _in_outing = any(
                    min(o['st_min'], o['et_min']) <= meal_min <= max(o['st_min'], o['et_min'])
                    for o in _day_outings
                )
                if not _in_outing:
                    _missing.append(meal_name)
            if _missing:
                meal_missing_days.append((date_short, _missing))

        # ── 혈압/체온 미기재 ────────────────────────────────────────────────
        vital = rec.nursing.get('vital_sign', {})
        if not vital.get('systolic') and not vital.get('temperature'):
            issues.append({"type":"혈압체온미기재","severity":"high",
                "location": loc_prefix,
                "description": "혈압/체온이 기재되지 않았습니다.",
                "suggestion": "매일 혈압·체온을 측정하고 기록하세요."})

        # ── 작성자 누락 (섹션별) ───────────────────────────────────────────
        for section, key in [
            ("신체활동", "physical"),
            ("인지관리", "cognitive"),
            ("건강간호", "nursing"),
            ("기능회복", "rehab"),
        ]:
            writer = rec.__dict__[key].get('writer') if hasattr(rec, key) else None
            # dataclass이므로
            section_data = getattr(rec, key, {})
            writer = section_data.get('writer') if isinstance(section_data, dict) else None
            if writer is None or (isinstance(writer, str) and not writer.strip()):
                issues.append({"type":"작성자누락","severity":"high",
                    "location": f"{loc_prefix} / {section}",
                    "description": f"{section}지원 섹션 작성자 성명이 누락되었습니다.",
                    "suggestion": f"{section}지원 작성자 성명란을 기재하세요."})

        # ── 휴무자 교차검증 ────────────────────────────────────────────────
        if date_str in sched_idx:
            all_writers = [
                rec.physical.get('writer'),
                rec.cognitive.get('writer'),
                rec.nursing.get('writer'),
                rec.rehab.get('writer'),
            ]
            for writer in all_writers:
                if not writer: continue
                if writer in sched_idx[date_str]:
                    sc = sched_idx[date_str][writer]
                    if not sc.get('is_working', True):
                        shift = sc.get('shift_label', '휴무')
                        issues.append({"type":"휴무자제공기록","severity":"high",
                            "location": f"{loc_prefix} / {writer}",
                            "description": f"{writer} 직원은 {date_short}({shift}) 처리되었으나 작성자로 기재되어 있습니다.",
                            "suggestion": "실제 근무자를 확인하거나 근무표를 수정하세요."})

        # ── 와상 어르신 이동도움 (일요일 아닌 날) ──────────────────────────
        mobility = rec.condition.get('mobility', '')
        if mobility == '와상' and rec_date.weekday() != 6:
            if rec.physical.get('mobility_support') is True:
                issues.append({"type":"와상이동도움이상","severity":"medium",
                    "location": f"{loc_prefix} ({rec_date.strftime('%A')})",
                    "description": f"완전와상 수급자의 이동도움이 일요일이 아닌 날({date_short})에 기록되어 있습니다.",
                    "suggestion": "와상 수급자 이동도움은 일요일에만 기록해야 합니다."})

        # ── 기저귀 대상자인데 기록 없음 ────────────────────────────────────
        if rec.equipment.get('diaper') and rec.condition.get('mobility') in ('와상', '준와상'):
            diaper = rec.physical.get('diaper_toilet', {})
            if not diaper.get('diaper_change_count') and not diaper.get('urine_count'):
                issues.append({"type":"기저귀기록누락","severity":"medium",
                    "location": loc_prefix,
                    "description": "기저귀 사용 수급자인데 화장실이용/기저귀교환 기록이 없습니다.",
                    "suggestion": "기저귀 교환 횟수와 대변/소변 횟수를 기록하세요."})

    # ── 목욕 월 5회 미만 (외박일 제외, 20일 이상인 경우만 판단) ──────────────
    _bath = sum(1 for r in present_records if (r.physical.get('bathing') or {}).get('provided'))
    if len(present_records) >= 20 and _bath < 5:
        issues.append({"type":"목욕횟수부족","severity":"medium",
            "location": f"{records[0].resident_name or ''} / 월 {_bath}회",
            "description": f"이번 달 목욕 제공 횟수가 {_bath}회로 권고 기준(월 5회) 미달입니다.",
            "suggestion": "목욕 제공 횟수를 월 5회 이상으로 늘리세요."})

    # ── 식사 미기록 (요약: 항목당 1건) ────────────────────────────────────
    if meal_missing_days:
        _sample = ', '.join(f"{d}({'·'.join(m)})" for d, m in meal_missing_days[:5])
        _more = f" 외 {len(meal_missing_days) - 5}일" if len(meal_missing_days) > 5 else ""
        issues.append({"type":"식사기록누락","severity":"medium",
            "location": f"{records[0].resident_name or ''} / {len(meal_missing_days)}일",
            "description": f"식사 기록이 누락된 날이 {len(meal_missing_days)}일 있습니다: {_sample}{_more}.",
            "suggestion": "제공한 식사 종류와 섭취량을 빠짐없이 기록하세요. (외박·외출 시간대는 제외됨)"})

    # ── 산책 빈도 (일반: 일 1회 / 와상: 주 1회) ─────────────────────────────
    if len(present_records) >= 7:
        walking_days = sum(
            1 for r in present_records
            if (r.physical.get('walking_support') or {}).get('walking') is True
        )
        active_days = len(present_records)
        if is_bedridden:
            weeks = max(1, (active_days + 6) // 7)
            if walking_days < weeks:
                issues.append({"type":"산책부족","severity":"medium",
                    "location": f"{records[0].resident_name or ''} / 산책 {walking_days}회",
                    "description": f"와상 어르신 산책(외출) 기록이 {walking_days}회로 주 1회 기준(약 {weeks}회)에 미달합니다.",
                    "suggestion": "와상 어르신도 주 1회 이상 산책·외출 동행을 기록하세요."})
        elif walking_days < active_days:
            issues.append({"type":"산책부족","severity":"low",
                "location": f"{records[0].resident_name or ''} / 산책 {walking_days}/{active_days}일",
                "description": f"산책(외출) 기록이 {active_days}일 중 {walking_days}일로 일 1회 권장에 미달합니다.",
                "suggestion": "일반 어르신은 매일 1회 이상 산책을 기록하세요."})

    # ── 배변 장기 누락 (기저귀 대상 또는 와상/준와상만 — 오탐 방지) ─────────
    _diaper_target = is_bedridden or any(
        (r.equipment.get('diaper') if isinstance(r.equipment, dict) else False) for r in records
    )
    if _diaper_target:
        _seq = sorted(
            [r for r in valid_records if _parse_date(r.service_date)],
            key=lambda r: _parse_date(r.service_date),
        )
        _streak = 0
        _s_start = None
        _s_prev = None
        _runs = []
        for r in _seq:
            rd = _parse_date(r.service_date)
            if any(sd <= rd <= ed for sd, ed in overnight_periods):
                if _streak >= 4:
                    _runs.append((_s_start, _s_prev, _streak))
                _streak = 0; _s_start = None; _s_prev = None
                continue
            _bowel = (r.physical.get('diaper_toilet') or {}).get('bowel_count')
            if not _bowel:   # None 또는 0
                if _streak == 0:
                    _s_start = rd
                _streak += 1
                _s_prev = rd
            else:
                if _streak >= 4:
                    _runs.append((_s_start, _s_prev, _streak))
                _streak = 0; _s_start = None; _s_prev = None
        if _streak >= 4:
            _runs.append((_s_start, _s_prev, _streak))
        for (_sd, _ed, _n) in _runs:
            issues.append({"type":"배변장기누락","severity":"medium",
                "location": f"{records[0].resident_name or ''} / {_sd}~{_ed}",
                "description": f"배변 기록이 {_n}일 연속 0회 또는 미기록입니다 ({_sd}~{_ed}).",
                "suggestion": "외박·입원 여부를 확인하고 배변 상태·조치사항을 기록하세요."})

    return sorted(issues, key=lambda x: SEV_ORDER.get(x.get('severity','low'), 9))


def calculate_score(issues: List[Issue]) -> int:
    score = 100
    ded = {"critical": 20, "high": 10, "medium": 5, "low": 1}
    for iss in issues:
        score -= ded.get(iss.get('severity','low'), 1)
    return max(0, score)


def get_grade(score: int) -> str:
    if score >= 95: return "양호(A)"
    if score >= 85: return "양호(B)"
    if score >= 70: return "보통(C)"
    return "미흡(D)"
