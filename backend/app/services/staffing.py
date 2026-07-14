"""
요양보호사 인력배치 및 입소 가능성 시뮬레이터 — 도메인 계산 서비스.

행정판정(공단 인력신고)은 코드만으로 확정할 수 없으므로 모든 결과는 '예상값'이며,
배치비율·1일 근무시간·최대 즉시채용 인원 등은 설정값으로 분리해 조정 가능하다.

전제(현 프로젝트): 별도 근무표(shift) 시스템이 없으므로
- 재직 중이면 해당 월 '풀근무'로 간주
- 월중 입사자는 입사일~월말의 근무가능일 비율로 확보시간을 산정(평균치)
"""
from __future__ import annotations

import calendar
import math
from datetime import date, timedelta
from typing import Optional

# ── 설정 기본값 (관리자 조정 가능) ───────────────────────────
DEFAULT_CONFIG = {
    "placement_ratio": 2.1,          # 입소자 N명당 요양보호사 1명
    "daily_hours": 8,                # 1일 기본 근무시간
    "daily_max_recognized_hours": 8, # 1일 최대 인정시간
    "max_immediate_hires": 3,        # 최대 즉시채용 가능인원
    "safety_factor": 1.0,            # 현실적 권장시간 = 이론상 × safety_factor (근무표 없으므로 기본 1.0)
    "full_month_hire_day": 3,        # 이 날짜 이하 월초 입사자는 만근 처리 (1~3일 입사 → 만근)
    "scan_days": 60,                 # 안전 입소일 탐색 범위(±)
}

EPS = 1e-9


def _d(s) -> Optional[date]:
    if not s:
        return None
    if isinstance(s, date):
        return s
    try:
        y, m, dd = str(s)[:10].split("-")
        return date(int(y), int(m), int(dd))
    except Exception:
        return None


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def month_bounds(year: int, month: int) -> tuple[date, date]:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    last = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last))


# ── 공휴일 ──────────────────────────────────────────────────

_KO_HOLIDAY = {
    "New Year's Day": "신정",
    "The day preceding Korean New Year": "설날 연휴",
    "Korean New Year": "설날",
    "The second day of Korean New Year": "설날 연휴",
    "Independence Movement Day": "삼일절",
    "Children's Day": "어린이날",
    "Buddha's Birthday": "부처님오신날",
    "Memorial Day": "현충일",
    "Liberation Day": "광복절",
    "The day preceding Chuseok": "추석 연휴",
    "Chuseok": "추석",
    "The second day of Chuseok": "추석 연휴",
    "National Foundation Day": "개천절",
    "Hangul Day": "한글날",
    "Christmas Day": "성탄절",
    "Constitution Day": "제헌절",
    "Local Election Day": "지방선거일",
    "Temporary Public Holiday": "임시공휴일",
    "Presidential Election Day": "대통령선거일",
    "National Assembly Election Day": "국회의원선거일",
}


def _ko_name(name: str) -> str:
    if not name:
        return "공휴일"
    if name in _KO_HOLIDAY:
        return _KO_HOLIDAY[name]
    if name.startswith("Alternative holiday for "):
        base = name[len("Alternative holiday for "):]
        return f"{_KO_HOLIDAY.get(base, base)} 대체공휴일"
    return name


def get_korean_holidays(year: int, extra: Optional[list] = None, table: Optional[list] = None) -> dict:
    """{iso_date: name} — 검증된 라이브러리 우선, 없으면 table(폴백)+규칙기반.
    table: [{date, name}] (holiday_calendar). extra: [iso] 관리자 지정 제외일."""
    out: dict[str, str] = {}
    # 1) 검증된 라이브러리
    try:
        import holidays as _h
        for d, name in _h.SouthKorea(years=year).items():
            out[d.isoformat()] = _ko_name(name)
    except Exception:
        # 3) 폴백: 규칙기반 고정 공휴일(특정연도 배열 아님) — 음력은 table 의존
        for (m, dd), name in {
            (1, 1): "신정", (3, 1): "삼일절", (5, 5): "어린이날", (6, 6): "현충일",
            (8, 15): "광복절", (10, 3): "개천절", (10, 9): "한글날", (12, 25): "성탄절",
        }.items():
            out[date(year, m, dd).isoformat()] = name
    # 근로자의 날(관공서 공휴일 아님 → 라이브러리 누락 가능하나 시설 근무 제외 대상)
    out.setdefault(date(year, 5, 1).isoformat(), "근로자의 날")
    # 2) 프로젝트 holiday_calendar (음력/대체/관리자 지정)
    for row in (table or []):
        di = _iso(_d(row.get("date")))
        if di and di[:4] == str(year):
            out[di] = row.get("name") or out.get(di) or "공휴일"
    # 관리자 추가 제외일
    for e in (extra or []):
        di = _iso(_d(e))
        if di:
            out.setdefault(di, "지정 제외일")
    return out


# ── 근무일 계산 ─────────────────────────────────────────────
def weekdays_in_range(start: date, end: date) -> int:
    if end < start:
        return 0
    n = 0
    d = start
    while d <= end:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


def workdays_in_range(start: date, end: date, holidays: set) -> int:
    """주말·공휴일 제외 근무가능일(포함구간). 주말·공휴일 중복 차감 없음."""
    if end < start:
        return 0
    n = 0
    d = start
    while d <= end:
        if d.weekday() < 5 and d.isoformat() not in holidays:
            n += 1
        d += timedelta(days=1)
    return n


def calculate_monthly_standard_hours(year: int, month: int, holidays: set, daily_hours: float = 8) -> dict:
    start, end = month_bounds(year, month)
    weekdays = weekdays_in_range(start, end)
    excluded = 0
    applied = []
    d = start
    while d <= end:
        di = d.isoformat()
        if d.weekday() < 5 and di in holidays:
            excluded += 1
        if di in holidays:
            applied.append(di)
        d += timedelta(days=1)
    workdays = weekdays - excluded
    return {
        "year": year, "month": month,
        "weekday_count": weekdays,
        "holiday_excluded_count": excluded,
        "workdays": workdays,
        "daily_hours": daily_hours,
        "hours": workdays * daily_hours,
        "applied_holiday_dates": sorted(applied),
    }


# ── 월평균 입소자 ───────────────────────────────────────────
def calculate_resident_days(residents: list, year: int, month: int) -> dict:
    start, end = month_bounds(year, month)
    total = 0
    per = []
    for r in residents:
        adm = _d(r.get("admission_date"))
        dis = _d(r.get("discharge_date"))
        if not adm:
            continue
        s = max(adm, start)
        e = min(dis, end) if dis else end
        if e < s:
            days = 0
        else:
            days = (e - s).days + 1  # 입소·퇴소일 모두 포함
        total += days
        per.append({"admission_date": _iso(adm), "discharge_date": _iso(dis),
                    "days": days, "planned": bool(r.get("planned"))})
    return {"total_days": total, "days_in_month": (end - start).days + 1, "per": per}


def calculate_average_resident_count(residents: list, year: int, month: int) -> float:
    rd = calculate_resident_days(residents, year, month)
    dim = rd["days_in_month"]
    return (rd["total_days"] / dim) if dim else 0.0


# ── 인력 경계값 ─────────────────────────────────────────────
def calculate_required_worker_count(avg: float, ratio: float) -> int:
    if avg <= 0:
        return 0
    return int(math.ceil(avg / ratio - EPS))


def calculate_required_hours(count: int, standard_hours: float) -> float:
    return count * standard_hours


# ── 직원별 확보(인정) 시간 ──────────────────────────────────
def leave_dates_in_month(worker: dict, year: int, month: int) -> set:
    """휴직 기간(leaves: [{start,end}])이 해당 월과 겹치는 날짜 집합."""
    start, end = month_bounds(year, month)
    out = set()
    for lv in (worker.get("leaves") or []):
        if not isinstance(lv, dict):
            continue
        ls = _d(lv.get("start"))
        le = _d(lv.get("end"))
        if not ls and not le:
            continue
        a = max(ls, start) if ls else start
        b = min(le, end) if le else end   # 종료일 미정 = 월말까지 휴직
        d = a
        while d <= b:
            out.add(d.isoformat())
            d += timedelta(days=1)
    return out


def worker_expected_hours(worker: dict, year: int, month: int, holidays: set,
                          daily_hours: float, standard_hours: float,
                          full_month_hire_day: int = 3) -> float:
    """당월 확보 예상 인정시간.

    산식 (달력일수 비례):
        확보시간 = 월 기준시간 ÷ 월 총일수(28~31) × 재직일수
        재직일수 = max(입사일, 월초) ~ min(퇴사일, 월말)  (양끝 포함) − 휴직일수

    - 월초(기본 1~3일) 입사자는 만근 처리 → 재직일수 = 월 총일수
    - 재직 중이면 '풀근무' 전제 (근무표 시스템 없음)
    - 실제/예정 시간이 입력돼 있으면 그 값을 우선 사용
    """
    actual = worker.get("actual_work_hours")
    expected = worker.get("expected_work_hours")
    if actual is not None or expected is not None:
        return float(actual or 0) + float(expected or 0)
    rec = worker.get("recognized_work_hours")
    if rec is not None:
        return float(rec)

    start, end = month_bounds(year, month)
    days_in_month = (end - start).days + 1

    hire = _d(worker.get("hire_date"))
    resign = _d(worker.get("resign_date") or worker.get("resignation_date"))

    # 월초 입사자(1~full_month_hire_day일)는 만근 → 월초부터 재직한 것으로 계산
    eff_hire = hire
    if hire and hire.year == year and hire.month == month and hire.day <= int(full_month_hire_day):
        eff_hire = start

    s_day = max(eff_hire, start) if eff_hire else start
    e_day = min(resign, end) if resign else end
    if e_day < s_day:
        return 0.0

    employed_days = (e_day - s_day).days + 1

    # 휴직: 재직 구간과 겹치는 날만 차감
    leaves = leave_dates_in_month(worker, year, month)
    if leaves:
        s_iso, e_iso = s_day.isoformat(), e_day.isoformat()
        leave_days = sum(1 for d in leaves if s_iso <= d <= e_iso)
        employed_days = max(0, employed_days - leave_days)

    if days_in_month <= 0:
        return 0.0
    return round(standard_hours * employed_days / days_in_month, 1)


def calculate_expected_recognized_hours(workers: list, year: int, month: int, holidays: set,
                                        daily_hours: float, standard_hours: float,
                                        full_month_hire_day: int = 3) -> dict:
    total = 0.0
    per = []
    for w in workers:
        h = worker_expected_hours(w, year, month, holidays, daily_hours, standard_hours, full_month_hire_day)
        total += h
        meets = h + EPS >= standard_hours
        lv = leave_dates_in_month(w, year, month)
        overridden = any(w.get(k) is not None for k in
                         ("actual_work_hours", "expected_work_hours", "recognized_work_hours"))
        per.append({
            "employee_id": w.get("employee_id"),
            "name": w.get("employee_name") or w.get("name"),
            "hire_date": _iso(_d(w.get("hire_date"))),
            "overridden": overridden,
            "is_expected_hire": bool(w.get("is_expected_hire")),
            "actual_work_hours": w.get("actual_work_hours"),
            "expected_work_hours": w.get("expected_work_hours"),
            "hours": round(h, 1),
            "meets_standard": meets,
            "leave_days": len(lv),
            "on_leave": len(lv) > 0,
        })
    return {"total": total, "per": per}


def calculate_shortage_hours(required_total: float, secured: float) -> float:
    return max(0.0, required_total - secured)


# ── 신규 1인 근무 가능시간 ──────────────────────────────────
def calculate_worker_theoretical_max_hours(hire: date, year: int, month: int,
                                           holidays: set, daily_max: float) -> float:
    _, end = month_bounds(year, month)
    return workdays_in_range(hire, end, holidays) * daily_max


def calculate_hire_contribution_hours(hire: date, year: int, month: int,
                                      standard_hours: float,
                                      full_month_hire_day: int = 3) -> float:
    """신규 입사자가 당월 확보하는 인정시간 (직원 산식과 동일).
       월 기준시간 ÷ 월 총일수 × (입사일~말일 일수). 월초 1~3일 입사는 만근."""
    return worker_expected_hours(
        {"hire_date": _iso(hire)}, year, month, set(), 0, standard_hours, full_month_hire_day)


def calculate_worker_recommended_max_hours(theoretical: float, safety_factor: float = 1.0) -> float:
    return round(theoretical * safety_factor, 1)


# ── 후보자 시간 배분 / 최소 인원 ────────────────────────────
def calculate_candidate_hour_allocation(shortage: float, candidate_hours: list) -> dict:
    """가능시간 큰 순 누적. {count, allocation, total, feasible}."""
    hrs = sorted([float(h) for h in candidate_hours if h and h > 0], reverse=True)
    total = sum(hrs)
    if shortage <= EPS:
        return {"count": 0, "allocation": [], "total": total, "feasible": True}
    acc = 0.0
    alloc = []
    for h in hrs:
        need = shortage - acc
        use = min(h, max(0.0, need))
        alloc.append(round(use, 1))
        acc += h
        if acc + EPS >= shortage:
            return {"count": len(alloc), "allocation": alloc, "total": total, "feasible": True}
    return {"count": len(hrs), "allocation": alloc, "total": total, "feasible": False}


def calculate_minimum_candidate_count(shortage: float, candidate_hours: list,
                                      single_recommended: float) -> Optional[int]:
    if shortage <= EPS:
        return 0
    if candidate_hours:
        res = calculate_candidate_hour_allocation(shortage, candidate_hours)
        return res["count"] if res["feasible"] else None
    if single_recommended and single_recommended > 0:
        return int(math.ceil(shortage / single_recommended - EPS))
    return None


# ── 근무표(수학 vs 편성) 가능성 ─────────────────────────────
def evaluate_schedule_feasibility(new_count: Optional[int], max_immediate: int,
                                  days_remaining: int, hours_feasible: bool) -> dict:
    """근무표 시스템 부재 → 즉시채용 인원·잔여기간 기반 휴리스틱(예상값)."""
    if new_count is None or not hours_feasible:
        return {"feasible": False, "note": "후보 근무시간 합계가 부족시간에 미달"}
    if new_count > max_immediate:
        return {"feasible": False, "note": f"필요 신규 {new_count}명 > 최대 즉시채용 {max_immediate}명"}
    if days_remaining <= 0:
        return {"feasible": False, "note": "월말까지 근무가능일이 없음"}
    return {"feasible": True, "note": "즉시채용·편성 가능(예상)"}


# ── 실현 가능성 등급 ────────────────────────────────────────
def evaluate_staffing_feasibility(shortage: float, single_recommended: float,
                                  candidate_hours: list, max_immediate: int,
                                  schedule_feasible: bool) -> Optional[str]:
    if shortage <= EPS:
        return None
    min_count = calculate_minimum_candidate_count(shortage, candidate_hours, single_recommended)
    if min_count is None:
        return "PRACTICALLY_IMPOSSIBLE"
    if min_count > max_immediate:
        return "PRACTICALLY_IMPOSSIBLE"
    if not schedule_feasible:
        return "HIGH_OPERATIONAL_RISK"
    if min_count <= 1:
        return "FEASIBLE_SINGLE"
    if min_count <= 3:
        return "FEASIBLE_DISTRIBUTED"
    return "HIGH_OPERATIONAL_RISK"


# ── 입소 가능성 상태 ────────────────────────────────────────
def evaluate_admission_status(shortage: float, feasibility_level: Optional[str],
                              earliest_safe: Optional[str], year: int, month: int) -> str:
    if shortage <= EPS:
        return "SAFE"
    if feasibility_level in ("FEASIBLE_SINGLE", "FEASIBLE_DISTRIBUTED", "HIGH_OPERATIONAL_RISK"):
        return "CONDITIONAL"
    # PRACTICALLY_IMPOSSIBLE
    if earliest_safe:
        es = _d(earliest_safe)
        if es and (es.year, es.month) != (year, month):
            return "NEXT_MONTH_RECOMMENDED"
    return "UNSAFE_THIS_MONTH"


# ── 최종 안전 채용일 (신규 n명) ─────────────────────────────
def calculate_latest_safe_hire_date(n: int, shortage: float, year: int, month: int,
                                    holidays: set, daily_hours: float,
                                    as_of: Optional[date] = None) -> Optional[str]:
    """신규 n명이 각 (shortage/n)시간을 확보하려면 가장 늦게 입사해도 되는 날."""
    if n <= 0 or shortage <= EPS:
        return None
    per_need = shortage / n
    start, end = month_bounds(year, month)
    lo = as_of or start
    if lo < start:
        lo = start
    latest = None
    d = lo
    while d <= end:
        if calculate_worker_theoretical_max_hours(d, year, month, holidays, daily_hours) + EPS >= per_need:
            latest = d
        d += timedelta(days=1)
    return _iso(latest)


# ── 가장 빠른 안전 입소일 ───────────────────────────────────
def _shortage_for_admission(base_residents: list, planned: list, admission_date: date,
                            workers: list, candidate_hours: list, config: dict,
                            holidays_by_year: dict) -> dict:
    """주어진 입소일로 planned 를 반영했을 때 해당 월의 필요/부족 계산."""
    y, m = admission_date.year, admission_date.month
    hol = holidays_by_year.get(y) or {}
    holset = set(hol.keys())
    std = calculate_monthly_standard_hours(y, m, holset, config["daily_hours"])["hours"]
    # planned admissions 를 admission_date 로 이동
    planned_moved = []
    for p in planned:
        pp = dict(p)
        pp["admission_date"] = _iso(admission_date)
        pp["planned"] = True
        planned_moved.append(pp)
    residents = base_residents + planned_moved
    avg = calculate_average_resident_count(residents, y, m)
    req = calculate_required_worker_count(avg, config["placement_ratio"])
    req_total = calculate_required_hours(req, std)
    secured = calculate_expected_recognized_hours(workers, y, m, holset, config["daily_hours"], std,
                                                  config.get("full_month_hire_day", 3))["total"]
    secured += sum(float(h) for h in candidate_hours if h)
    shortage = calculate_shortage_hours(req_total, secured)
    return {"year": y, "month": m, "avg": avg, "required": req, "shortage": shortage, "standard": std}


def find_earliest_safe_admission_date(base_residents: list, planned: list, current_admission: date,
                                      workers: list, candidate_hours: list, config: dict,
                                      holidays_by_year: dict, as_of: Optional[date] = None) -> Optional[str]:
    scan = int(config.get("scan_days", 60))
    start = current_admission
    for offset in range(0, scan + 1):
        d = start + timedelta(days=offset)
        info = _shortage_for_admission(base_residents, planned, d, workers, candidate_hours, config, holidays_by_year)
        if info["shortage"] <= EPS:
            # 다음 달도 확인(입소가 다음달로 넘어가면 그 달 기준 충족 필요)
            return _iso(d)
    return None


# ── 다음 달 필요 정규직 ─────────────────────────────────────
def calculate_next_month_projection(residents: list, planned: list, year: int, month: int,
                                    current_worker_count: int, config: dict,
                                    holidays_next: set) -> dict:
    nxt = add_months(date(year, month, 1), 1)
    ny, nm = nxt.year, nxt.month
    # 다음 달엔 현재 재원자+입소예정자가 계속 재원한다고 가정
    res = []
    for r in residents + planned:
        rr = dict(r)
        res.append(rr)
    avg = calculate_average_resident_count(res, ny, nm)
    req = calculate_required_worker_count(avg, config["placement_ratio"])
    additional = max(0, req - current_worker_count)
    return {
        "year": ny, "month": nm,
        "avg": round(avg, 2),
        "required_worker_count": req,
        "additional_full_time_workers": additional,
    }


# ── 자연어 설명 ─────────────────────────────────────────────
def generate_staffing_explanation(ctx: dict) -> str:
    status = ctx["admission_status"]
    level = ctx.get("feasibility_level")
    shortage = ctx["shortage_hours"]
    min_new = ctx.get("minimum_new_worker_count")
    single = ctx.get("single_worker_recommended_max_hours") or 0
    latest = ctx.get("latest_safe_hire_dates") or {}
    earliest = ctx.get("earliest_safe_admission_date")
    if status == "SAFE":
        return "현재 인력으로 이번 달과 다음 달 인력기준을 충족할 수 있습니다. 추가 채용 없이 입소가 가능합니다."
    if level == "FEASIBLE_SINGLE":
        hire_by = latest.get("1")
        by = f" {hire_by}까지" if hire_by else ""
        return (f"신규 요양보호사 1명을{by} 채용하면 이번 달 부족시간 {int(shortage)}시간을 확보할 수 있습니다. "
                f"입소 예정일을 변경할 필요는 없습니다.")
    if level == "FEASIBLE_DISTRIBUTED":
        per = round(shortage / max(1, (min_new or 2)))
        return (f"신규 직원 1명만으로는 이번 달 부족시간을 충족하기 어렵습니다. "
                f"신규 요양보호사 {min_new}명을 채용하여 각각 약 {per}시간씩 근무시키면 "
                f"총 {int(shortage)}시간을 확보할 수 있습니다.")
    if level == "HIGH_OPERATIONAL_RISK":
        return (f"수학적으로는 신규 요양보호사 {min_new}명의 근무시간을 합산하면 기준을 충족할 수 있습니다. "
                f"다만 월말까지 여러 명을 즉시 채용하고 편성해야 하므로 운영상 위험이 큽니다. "
                f"입소일 조정을 우선 검토하세요.")
    # PRACTICALLY_IMPOSSIBLE / UNSAFE / NEXT_MONTH
    tail = f" 권장 입소일은 {earliest}입니다." if earliest else ""
    return (f"현재 확보된 인력과 신규 후보자의 근무 가능시간을 모두 합산해도 부족시간 {int(shortage)}시간을 "
            f"채우기 어렵습니다. 이번 달에는 인력기준 충족이 어려울 것으로 예상됩니다.{tail}")


# ── 시뮬레이션 오케스트레이터 ───────────────────────────────
def simulate(payload: dict, holiday_table: Optional[list] = None) -> dict:
    cfg = dict(DEFAULT_CONFIG)
    cfg.update(payload.get("config") or {})
    year = int(payload["year"])
    month = int(payload["month"])
    as_of = _d(payload.get("as_of")) or date.today()
    start, end = month_bounds(year, month)
    if not (start <= as_of <= end):
        as_of = start  # 과거/미래 월 시뮬레이션 시 월초 기준

    residents = payload.get("residents") or []
    planned = payload.get("planned_admissions") or []
    workers = payload.get("workers") or []
    candidates = payload.get("candidates") or []

    # 공휴일 (이번 달 + 다음 달 연도까지)
    nxt = add_months(start, 1)
    holidays_by_year = {}
    for yy in {year, nxt.year, add_months(start, 2).year}:
        holidays_by_year[yy] = get_korean_holidays(yy, payload.get("extra_excluded_dates"), holiday_table)
    hol = holidays_by_year[year]
    holset = set(hol.keys())

    std_info = calculate_monthly_standard_hours(year, month, holset, cfg["daily_hours"])
    std = std_info["hours"]

    # 월평균 입소자 (입소 전/후)
    before_avg = calculate_average_resident_count(residents, year, month)
    after_res = residents + [dict(p, planned=True) for p in planned]
    after_avg = calculate_average_resident_count(after_res, year, month)
    before_req = calculate_required_worker_count(before_avg, cfg["placement_ratio"])
    after_req = calculate_required_worker_count(after_avg, cfg["placement_ratio"])
    worker_increased = after_req > before_req

    # 확보 예상시간 (기존 직원 풀근무/월중입사 비율)
    sec = calculate_expected_recognized_hours(workers, year, month, holset, cfg["daily_hours"], std,
                                              cfg.get("full_month_hire_day", 3))
    secured = sec["total"]
    current_worker_count = len([w for w in sec["per"] if not w["is_expected_hire"] and w["hours"] > 0])
    max_allowed_avg = current_worker_count * cfg["placement_ratio"]

    req_total_before = calculate_required_hours(before_req, std)
    req_total_after = calculate_required_hours(after_req, std)
    shortage = calculate_shortage_hours(req_total_after, secured)

    # 신규 1인 가능시간 (즉시 채용 가정)
    single_hire = max(as_of, start)
    # 이론상 최대: 달력상 근무가능일 × 1일 최대시간 (참고용 상한)
    theo = calculate_worker_theoretical_max_hours(single_hire, year, month, holset, cfg["daily_max_recognized_hours"])
    # 현실적 확보시간: 직원과 동일 산식 (월 기준시간 ÷ 월 총일수 × 재직일수)
    reco = round(calculate_hire_contribution_hours(
        single_hire, year, month, std, cfg.get("full_month_hire_day", 3)) * cfg["safety_factor"], 1)
    remaining_workdays = workdays_in_range(single_hire, end, holset)
    remaining_caldays = (end - as_of).days + 1

    # 후보자 시간
    cand_hours = []
    cand_view = []
    for c in candidates:
        av = c.get("available_hours")
        if av is None:
            ch = _d(c.get("hire_date")) or single_hire
            av = round(calculate_hire_contribution_hours(
                max(ch, start), year, month, std, cfg.get("full_month_hire_day", 3)) * cfg["safety_factor"], 1)
        cand_hours.append(float(av))
        cand_view.append({"name": c.get("name"), "hire_date": _iso(_d(c.get("hire_date"))),
                          "available_hours": round(float(av), 1), "confirmed": bool(c.get("confirmed"))})
    cand_total = sum(cand_hours)
    confirmed_cnt = len([c for c in candidates if c.get("confirmed")])

    alloc = calculate_candidate_hour_allocation(shortage, cand_hours) if cand_hours else None
    min_count = calculate_minimum_candidate_count(shortage, cand_hours, reco)
    hours_feasible = (alloc["feasible"] if alloc else (reco > 0))
    sched = evaluate_schedule_feasibility(min_count, cfg["max_immediate_hires"], remaining_workdays, hours_feasible)
    level = evaluate_staffing_feasibility(shortage, reco, cand_hours, cfg["max_immediate_hires"], sched["feasible"])

    # 최종 안전 채용일 (1~4명)
    latest_hire = {}
    for n in (1, 2, 3, 4):
        latest_hire[str(n)] = calculate_latest_safe_hire_date(n, shortage, year, month, holset, cfg["daily_hours"], as_of)

    # 가장 빠른 안전 입소일
    base_admission = _d(planned[0]["admission_date"]) if planned and planned[0].get("admission_date") else as_of
    earliest_safe = None
    if shortage > EPS and planned:
        earliest_safe = find_earliest_safe_admission_date(
            residents, planned, base_admission, workers, cand_hours, cfg, holidays_by_year, as_of)

    admission_status = evaluate_admission_status(shortage, level, earliest_safe, year, month)

    # 다음 달
    nm_proj = calculate_next_month_projection(residents, planned, year, month,
                                              current_worker_count, cfg, set(holidays_by_year[nxt.year].keys()))

    recommended_new = min_count if min_count is not None else None
    candidate_shortage = max(0.0, shortage - cand_total) if cand_hours else shortage

    applied_holidays = [{"date": d, "name": hol[d]} for d in std_info["applied_holiday_dates"]]

    ctx = {
        "year": year, "month": month, "as_of": _iso(as_of),
        "config": cfg,
        "admission_status": admission_status,
        "feasibility_level": level,
        "before_avg_resident_count": round(before_avg, 2),
        "after_avg_resident_count": round(after_avg, 2),
        "before_required_worker_count": before_req,
        "after_required_worker_count": after_req,
        "worker_count_increased": worker_increased,
        "current_worker_count": current_worker_count,
        "max_allowed_avg_resident_count": round(max_allowed_avg, 2),
        "monthly_standard_hours": std,
        "monthly_standard_detail": std_info,
        "applied_holidays": applied_holidays,
        "secured_hours": round(secured, 1),
        "required_hours_before": round(req_total_before, 1),
        "required_hours_after": round(req_total_after, 1),
        "shortage_hours": round(shortage, 1),
        "single_worker_theoretical_max_hours": round(theo, 1),
        "single_worker_recommended_max_hours": round(reco, 1),
        "remaining_workdays": remaining_workdays,
        "remaining_calendar_days": remaining_caldays,
        "minimum_new_worker_count": min_count,
        "recommended_new_worker_count": recommended_new,
        "candidate_allocation": alloc,
        "candidate_detail": cand_view,
        "confirmed_candidate_count": confirmed_cnt,
        "candidate_total_available_hours": round(cand_total, 1),
        "candidate_shortage_hours": round(candidate_shortage, 1),
        "schedule_feasible": sched["feasible"],
        "schedule_note": sched["note"],
        "latest_safe_hire_dates": latest_hire,
        "earliest_safe_admission_date": earliest_safe,
        "next_month_required_worker_count": nm_proj["required_worker_count"],
        "next_month_additional_full_time_workers": nm_proj["additional_full_time_workers"],
        "next_month_projection": nm_proj,
        "worker_hours_detail": sec["per"],
        "resident_days": calculate_resident_days(after_res, year, month),
        "is_estimate": True,
    }
    ctx["recommendation"] = generate_staffing_explanation(ctx)
    return ctx
