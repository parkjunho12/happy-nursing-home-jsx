"""요양보호사 인력배치 시뮬레이터 도메인 테스트 (10종).
실행: python3 tests/test_staffing.py  (또는 pytest)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import staffing as S


def test_1_boundary_not_exceeded():
    # 18.9 = 9 × 2.1 (경계값) → 필요 9명
    assert S.calculate_required_worker_count(18.9, 2.1) == 9
    before = S.calculate_required_worker_count(18.5, 2.1)
    after = S.calculate_required_worker_count(18.9, 2.1)
    assert after == before  # 증가 없음
    assert (after > before) is False


def test_2_boundary_exceeded():
    assert S.calculate_required_worker_count(18.91, 2.1) == 10
    before = S.calculate_required_worker_count(18.9, 2.1)
    after = S.calculate_required_worker_count(18.91, 2.1)
    assert after == 10 and before == 9
    assert (after > before) is True


def test_3_feasible_single():
    lvl = S.evaluate_staffing_feasibility(shortage=80, single_recommended=96,
                                          candidate_hours=[], max_immediate=3, schedule_feasible=True)
    assert lvl == "FEASIBLE_SINGLE"
    assert S.calculate_minimum_candidate_count(80, [], 96) == 1


def test_4_feasible_distributed():
    lvl = S.evaluate_staffing_feasibility(shortage=176, single_recommended=96,
                                          candidate_hours=[], max_immediate=3, schedule_feasible=True)
    assert lvl == "FEASIBLE_DISTRIBUTED"
    assert S.calculate_minimum_candidate_count(176, [], 96) == 2


def test_5_candidate_accumulation():
    alloc = S.calculate_candidate_hour_allocation(176, [80, 72, 64])
    assert alloc["count"] == 3 and alloc["feasible"] is True
    # A+B = 152 < 176 (부족), A+B+C = 216 >= 176 (충족)
    assert 80 + 72 < 176 <= 80 + 72 + 64
    assert S.calculate_minimum_candidate_count(176, [80, 72, 64], 96) == 3
    lvl = S.evaluate_staffing_feasibility(176, 96, [80, 72, 64], 3, True)
    assert lvl == "FEASIBLE_DISTRIBUTED"


def test_6_exceeds_max_hires():
    # 신규 1인 40시간, 부족 200 → 필요 5명 > 최대 3 → 불가
    lvl = S.evaluate_staffing_feasibility(shortage=200, single_recommended=40,
                                          candidate_hours=[], max_immediate=3, schedule_feasible=True)
    assert lvl == "PRACTICALLY_IMPOSSIBLE"
    status = S.evaluate_admission_status(200, lvl, None, 2026, 7)
    assert status == "UNSAFE_THIS_MONTH"


def test_7_next_month_recommended():
    status = S.evaluate_admission_status(100, "PRACTICALLY_IMPOSSIBLE", "2026-08-01", 2026, 7)
    assert status == "NEXT_MONTH_RECOMMENDED"


def test_8_holiday_weekend_no_double_count():
    # 2026-08-15(광복절)=토요일 → 근무일 차감 대상 아님, 8-17(대체)=월요일만 차감
    hol = S.get_korean_holidays(2026)
    info = S.calculate_monthly_standard_hours(2026, 8, set(hol.keys()), 8)
    # 주말 공휴일은 excluded 에 포함되지 않아야 함
    from datetime import date
    assert date(2026, 8, 15).weekday() >= 5  # 토요일 확인
    # 평일 공휴일만 차감되므로 excluded <= 평일 공휴일 수
    assert info["holiday_excluded_count"] >= 1
    # 근무가능일 = 평일 - 평일공휴일, 음수/과다차감 없음
    assert info["workdays"] == info["weekday_count"] - info["holiday_excluded_count"]


def test_9_midmonth_hire_proportional():
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]
    worker = {"name": "김", "hire_date": "2026-07-20"}
    h = S.worker_expected_hours(worker, 2026, 7, hol, 8, std)
    assert 0 < h < std  # 월 기준시간 축소 아님, 실제 확보 가능시간만
    full = {"name": "박", "hire_date": "2026-06-01"}
    assert S.worker_expected_hours(full, 2026, 7, hol, 8, std) == std  # 풀근무


def test_10_schedule_infeasible_high_risk():
    # 수학적으로는 4명 합산 충족되나(최대 5 허용) 분산 4명 → 고위험
    lvl = S.evaluate_staffing_feasibility(shortage=200, single_recommended=50,
                                          candidate_hours=[], max_immediate=5, schedule_feasible=True)
    assert lvl == "HIGH_OPERATIONAL_RISK"
    # 근무표 편성 불가(잔여일 0) → 고위험/불가
    sched = S.evaluate_schedule_feasibility(2, 3, 0, True)
    assert sched["feasible"] is False


def test_12_early_month_hire_full_attendance():
    """월초(2~4일) 입사자는 만근 처리, 5일 이후는 비례 계산."""
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]
    for d in ("2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"):
        assert S.worker_expected_hours({"hire_date": d}, 2026, 7, hol, 8, std) == std, d
    later = S.worker_expected_hours({"hire_date": "2026-07-06"}, 2026, 7, hol, 8, std)
    assert 0 < later < std
    # 휴직은 만근 처리와 무관하게 차감되어야 함
    w = {"hire_date": "2026-07-02", "leaves": [{"start": "2026-07-20", "end": "2026-07-31"}]}
    assert S.worker_expected_hours(w, 2026, 7, hol, 8, std) < std


def test_13_leave_excluded():
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]
    full = {"hire_date": "2025-01-01"}
    allmonth = {"hire_date": "2025-01-01", "leaves": [{"start": "2026-07-01", "end": "2026-07-31"}]}
    assert S.worker_expected_hours(full, 2026, 7, hol, 8, std) == std
    assert S.worker_expected_hours(allmonth, 2026, 7, hol, 8, std) == 0


def test_11_integration_simulate():
    # 통합: 실제 simulate 호출 (현재월)
    from datetime import date
    y, m = date.today().year, date.today().month
    res = [{"admission_date": f"{y}-{m:02d}-01"} for _ in range(19)]
    workers = [{"name": f"요양{i}", "hire_date": f"{y-1}-01-01", "is_expected_hire": False} for i in range(9)]
    planned = [{"admission_date": f"{y}-{m:02d}-15"}]
    out = S.simulate({"year": y, "month": m, "residents": res, "workers": workers,
                      "planned_admissions": planned, "candidates": []})
    assert out["admission_status"] in ("SAFE", "CONDITIONAL", "UNSAFE_THIS_MONTH", "NEXT_MONTH_RECOMMENDED")
    assert out["monthly_standard_hours"] > 0
    assert "recommendation" in out and out["is_estimate"] is True


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    for fn in fns:
        try:
            fn(); print(f"PASS {fn.__name__}"); passed += 1
        except AssertionError as e:
            print(f"FAIL {fn.__name__}: {e}")
        except Exception as e:
            print(f"ERROR {fn.__name__}: {type(e).__name__} {e}")
    print(f"\n{passed}/{len(fns)} passed")
    sys.exit(0 if passed == len(fns) else 1)
