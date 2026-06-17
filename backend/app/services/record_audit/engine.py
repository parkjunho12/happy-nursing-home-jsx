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

    # 외박/외출 기간
    leave_periods = []
    for l in leaves:
        sd = _parse_date(l.get('start_date'))
        ed = _parse_date(l.get('end_date'))
        if sd: leave_periods.append((sd, ed or sd, l.get('leave_type', '')))

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

        # ── 외박/외출 중 기록 ────────────────────────────────────────────────
        for sd, ed, ltype in leave_periods:
            if sd <= rec_date <= ed:
                issues.append({"type":"외박외출중제공기록","severity":"high",
                    "location": f"{loc_prefix} ({ltype})",
                    "description": f"{ltype} 기간({sd}~{ed}) 중 시설 내 서비스 기록이 있습니다.",
                    "suggestion": "외박/외출 기간 기록은 급여 청구 반려 사유입니다."})

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

    # ── 목욕 월 5회 미만 (입소일 이후 20일 이상인 경우만 판단) ──────────────
    if len(valid_records) >= 20 and len(bathing_dates) < 5:
        issues.append({"type":"목욕횟수부족","severity":"medium",
            "location": f"{records[0].resident_name or ''} / 월 {len(bathing_dates)}회",
            "description": f"이번 달 목욕 제공 횟수가 {len(bathing_dates)}회로 권고 기준(월 5회) 미달입니다.",
            "suggestion": "목욕 제공 횟수를 월 5회 이상으로 늘리세요."})

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
