"""
제공기록지 Rule Engine
- DB 데이터(수급자, 외박/외출)를 기준으로 객관적 판단
- LLM은 설명 생성만 담당 (판단 금지)
"""
import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional


Issue = Dict[str, str]   # {type, severity, location, description, suggestion}


def _parse_date(s: Any) -> Optional[date]:
    if not s:
        return None
    for fmt in ('%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d'):
        try:
            return datetime.strptime(str(s)[:10], fmt).date()
        except ValueError:
            pass
    return None


def _extract_dates_from_text(text: str) -> List[date]:
    """제공기록지 텍스트에서 서비스 날짜 추출 (2020년 이후만)"""
    patterns = [
        r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})',
        r'(\d{2,4})[년][\s]*(\d{1,2})[월][\s]*(\d{1,2})',
    ]
    dates = []
    for pat in patterns:
        for m in re.finditer(pat, text):
            try:
                y = int(m.group(1))
                mo = int(m.group(2))
                dy = int(m.group(3))
                if y < 100:
                    y += 2000
                # 2020년 이전은 생년월일 등 비서비스 날짜일 가능성 높음 → 스킵
                if y < 2020:
                    continue
                if 1 <= mo <= 12 and 1 <= dy <= 31:
                    dates.append(date(y, mo, dy))
            except (ValueError, OverflowError):
                pass
    return list(set(dates))


def _extract_names_from_text(text: str) -> List[str]:
    """
    제공기록지 텍스트에서 수급자명 패턴 추출
    오탐 방지: '어르신', '님' 접미사가 있는 경우만 추출
    """
    # "홍길동 어르신", "홍길동님" 패턴만 — 일반 한글 단어 오탐 방지
    names = re.findall(r'([가-힣]{2,4})(?:어르신|님)', text)
    return list(set(names))


def run_rules(
    record_text: str,
    residents: List[Dict],
    leaves: List[Dict],
    schedules: List[Dict] = None,
    record_items: List[Dict] = None,  # parse_record_xls 결과 (구조화된 데이터)
) -> List[Issue]:
    """Rule Engine 실행 — 객관적 이슈만 반환"""
    issues: List[Issue] = []
    record_dates = _extract_dates_from_text(record_text)
    record_names = _extract_names_from_text(record_text)

    # 수급자 딕셔너리: name → resident
    res_by_name: Dict[str, Dict] = {r["name"]: r for r in residents}

    # ── Rule 1. 미등록 수급자 ──────────────────────────────────────────────
    # 수급자 DB가 있고, 이름 패턴("OOO어르신/님")이 텍스트에서 명확히 추출된 경우만
    if residents and record_names:
        for name in record_names:
            if name not in res_by_name and len(name) >= 2:
                issues.append({
                    "type": "수급자정보불일치", "severity": "medium",
                    "location": f"수급자명: {name}",
                    "description": f"'{name}어르신' 기록이 있으나 수급자 정보 DB에 등록되지 않은 이름입니다.",
                    "suggestion": "수급자 정보를 확인하거나 이름 표기 방식이 다른지 확인하세요.",
                })

    # ── Rule 2. 입소 전 기록 / Rule 3. 퇴소 후 기록 ──────────────────────
    for name, res in res_by_name.items():
        if name not in record_text:
            continue
        adm = _parse_date(res.get("admission_date"))
        dis = _parse_date(res.get("discharge_date"))
        status = res.get("status", "active")

        for rd in record_dates:
            if adm and rd < adm:
                issues.append({
                    "type": "입소전기록", "severity": "high",
                    "location": f"{name} / {rd}",
                    "description": f"{name} 어르신의 입소일({adm}) 이전 날짜({rd})에 제공기록이 있습니다.",
                    "suggestion": "제공기록지 날짜를 확인하거나 입소일 데이터를 검토하세요.",
                })
            if dis and rd > dis:
                issues.append({
                    "type": "퇴소후기록", "severity": "high",
                    "location": f"{name} / {rd}",
                    "description": f"{name} 어르신의 퇴소일({dis}) 이후 날짜({rd})에 제공기록이 있습니다.",
                    "suggestion": "퇴소 이후 제공기록지 작성은 부적절합니다.",
                })

        # ── Rule 8. 상태 불일치 ──────────────────────────────────────────
        if status == "deceased" and record_dates:
            issues.append({
                "type": "사망후기록", "severity": "critical",
                "location": f"{name}",
                "description": f"{name} 어르신은 사망 처리된 수급자입니다. 해당 어르신의 제공기록이 존재합니다.",
                "suggestion": "즉시 원장에게 보고하고 기록 경위를 확인하세요.",
            })
        elif status == "inactive" and record_dates:
            issues.append({
                "type": "퇴소후기록", "severity": "high",
                "location": f"{name}",
                "description": f"{name} 어르신은 퇴소 상태입니다. 해당 어르신의 제공기록이 존재합니다.",
                "suggestion": "퇴소 이후 제공기록 여부를 확인하세요.",
            })

    # ── Rule 4 & 5. 외출·외박 중 급여제공 ───────────────────────────────
    for leave in leaves:
        name  = leave.get("resident_name", "")
        ltype = leave.get("leave_type", "외출")
        sd    = _parse_date(leave.get("start_date"))
        ed    = _parse_date(leave.get("end_date"))

        if not name or not sd or name not in record_text:
            continue

        for rd in record_dates:
            in_leave = (
                (ed is None and rd == sd) or
                (ed and sd <= rd <= ed)
            )
            if in_leave:
                severity = "critical" if ltype == "외박" else "high"
                issues.append({
                    "type": "외박외출중제공기록", "severity": severity,
                    "location": f"{name} / {rd} ({ltype} 기간)",
                    "description": (
                        f"{name} 어르신의 {ltype} 기간({sd}~{ed or sd}) 중 "
                        f"날짜({rd})에 시설 내 급여제공 기록이 있습니다."
                    ),
                    "suggestion": f"{ltype} 기간 중 제공기록은 급여청구 반려 사유가 될 수 있습니다. 즉시 확인하세요.",
                })

    # ── Rule 6. 외출·외박인데 특이사항 미기록 ───────────────────────────
    for leave in leaves:
        name = leave.get("resident_name", "")
        sd   = _parse_date(leave.get("start_date"))
        if not name or not sd or name not in record_text:
            continue
        # 제공기록지에 해당 날짜가 있는데 외출/외박 언급이 없으면
        date_str = str(sd)
        if date_str in record_text and name in record_text:
            leave_keywords = ['외출', '외박', '병원', '귀원', '복귀', '출발']
            context = record_text[max(0, record_text.find(date_str)-200):
                                   record_text.find(date_str)+500]
            if not any(kw in context for kw in leave_keywords):
                issues.append({
                    "type": "외박외출미기록", "severity": "medium",
                    "location": f"{name} / {sd}",
                    "description": f"{name} 어르신의 {leave.get('leave_type','외출')} 기록이 있으나 해당일 제공기록지 특이사항에 외출/외박 내용이 없습니다.",
                    "suggestion": "특이사항란에 외출/외박 시간, 귀원 여부를 기재하세요.",
                })

    # ── Rule 7. 동명이인 경고 ────────────────────────────────────────────
    name_counts: Dict[str, int] = {}
    for r in residents:
        name_counts[r["name"]] = name_counts.get(r["name"], 0) + 1
    for name, cnt in name_counts.items():
        if cnt > 1 and name in record_text:
            issues.append({
                "type": "동명이인주의", "severity": "medium",
                "location": f"수급자명: {name}",
                "description": f"'{name}' 이름의 수급자가 {cnt}명 등록되어 있습니다. 동명이인 혼동 가능성이 있습니다.",
                "suggestion": "생년월일 또는 생활실로 구분해서 기록하세요.",
            })


    # ── 근무표 Rule (schedules가 있을 때만) ────────────────────────────────
    if schedules and not record_items:  # 구조화 데이터 없을 때만 텍스트 기반 탐지
        # 날짜별 근무 인덱스
        sched_index: Dict[str, Dict[str, Dict]] = {}  # date → name → schedule
        for sc in schedules:
            d  = sc.get("work_date", "")
            nm = sc.get("staff_name", "")
            if not d or not nm:
                continue
            if d not in sched_index:
                sched_index[d] = {}
            sched_index[d][nm] = sc

        for rd in record_dates:
            rd_str = str(rd)
            if rd_str not in sched_index:
                continue
            day_sched = sched_index[rd_str]

            for staff_name, sc in day_sched.items():
                if staff_name not in record_text:
                    continue

                # WS001: 휴무자 제공기록
                if sc.get("is_working") is False:
                    shift = sc.get("shift_label", sc.get("shift_code", "휴무"))
                    issues.append({
                        "type": "휴무자제공기록", "severity": "high",
                        "location": f"{staff_name} / {rd_str} ({shift})",
                        "description": (
                            f"{staff_name} 직원은 {rd_str} {shift} 처리되었으나 "
                            f"제공기록지에 급여 제공자로 기록되어 있습니다."
                        ),
                        "suggestion": "근무표와 제공기록지를 대조해 기록 경위를 확인하세요.",
                    })

                # WS002: 근무시간 외 제공기록
                elif sc.get("start_time") and sc.get("end_time"):
                    # 텍스트에서 해당 직원 주변 시간 패턴 탐색
                    context = ""
                    idx = record_text.find(staff_name)
                    if idx >= 0:
                        context = record_text[idx:idx+500]
                    time_pats = re.findall(r'(\d{1,2}):(\d{2})', context)
                    for hh, mm in time_pats:
                        rec_time = f"{int(hh):02d}:{mm}"
                        st = sc["start_time"]
                        et = sc["end_time"]
                        # 야간(종료시간 < 시작시간) 처리
                        if st <= et:
                            out_of_shift = not (st <= rec_time <= et)
                        else:
                            out_of_shift = not (rec_time >= st or rec_time <= et)
                        if out_of_shift:
                            issues.append({
                                "type": "근무시간외제공기록", "severity": "high",
                                "location": f"{staff_name} / {rd_str} {rec_time}",
                                "description": (
                                    f"{staff_name} 직원의 근무시간({st}~{et}) 외인 "
                                    f"{rec_time}에 제공기록이 있습니다."
                                ),
                                "suggestion": "근무시간과 제공기록 시간 일치 여부를 확인하세요.",
                            })
                            break  # 같은 날 중복 이슈 방지


    # ── 근무표 × 파서 구조화 데이터 교차검증 ─────────────────────────────────
    # Claude 텍스트 분석보다 정확 — 파서가 이미 날짜/작성자를 정확히 추출
    if schedules and record_items:
        sched_off: Dict[str, List[str]] = {}  # staff_name → [off_dates]
        for sc in schedules:
            if not sc.get('is_working'):
                nm = sc.get('staff_name', '')
                dt = sc.get('work_date', '')
                if nm and dt:
                    sched_off.setdefault(nm, []).append(dt)

        for item in record_items:
            date   = item.get('date', '')
            res    = item.get('resident_name', '')
            sheet  = item.get('sheet', '')
            writers = item.get('writers', [])
            for writer in writers:
                if writer in sched_off and date in sched_off[writer]:
                    # 근무표상 휴무인 직원이 해당 날짜 작성자로 기재됨
                    # 어떤 시프트인지 찾기
                    shift_label = next(
                        (s.get('shift_label','휴무') for s in schedules
                         if s.get('staff_name') == writer and s.get('work_date') == date),
                        '휴무'
                    )
                    issues.append({
                        "type": "휴무자제공기록", "severity": "high",
                        "location": f"[{sheet}] {date[5:].replace('-','/')} / {res} / {writer} 작성",
                        "description": (
                            f"{writer} 직원은 {date}({shift_label}) 처리되었으나 "
                            f"{res} 어르신 제공기록지 작성자로 기재되어 있습니다."
                        ),
                        "suggestion": "실제 근무자 확인 후 작성자를 정정하거나, 해당일 실제 근무 시 근무표 수정 및 사유를 기록하세요.",
                    })

    return issues


def calculate_score(issues: List[Issue]) -> int:
    """점수 계산 — Rule Engine 결과만 사용"""
    score = 100
    deductions = {"critical": 20, "high": 10, "medium": 5, "low": 1}
    for issue in issues:
        score -= deductions.get(issue.get("severity", "low"), 1)
    return max(0, score)


def get_grade(score: int) -> str:
    if score >= 95: return "양호(A)"
    if score >= 85: return "양호(B)"
    if score >= 70: return "보통(C)"
    return "미흡(D)"
