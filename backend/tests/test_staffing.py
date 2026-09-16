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
    """월중 입사자: 월 기준시간 ÷ 월 총일수 × 재직일수 (달력일수 비례)."""
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]  # 176
    # 7월 = 31일. 7/20 입사 → 재직 12일 → 176 × 12/31
    h = S.worker_expected_hours({"hire_date": "2026-07-20"}, 2026, 7, hol, 8, std)
    assert h == round(std * 12 / 31, 1), h
    assert 0 < h < std
    # 풀근무(전월 입사) → 만근
    assert S.worker_expected_hours({"hire_date": "2026-06-01"}, 2026, 7, hol, 8, std) == std


def test_10_schedule_infeasible_high_risk():
    # 수학적으로는 4명 합산 충족되나(최대 5 허용) 분산 4명 → 고위험
    lvl = S.evaluate_staffing_feasibility(shortage=200, single_recommended=50,
                                          candidate_hours=[], max_immediate=5, schedule_feasible=True)
    assert lvl == "HIGH_OPERATIONAL_RISK"
    # 근무표 편성 불가(잔여일 0) → 고위험/불가
    sched = S.evaluate_schedule_feasibility(2, 3, 0, True)
    assert sched["feasible"] is False


def test_12_early_month_hire_full_attendance():
    """월초 1~3일 입사자는 만근, 4일 이후는 달력일수 비례."""
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]
    for d in ("2026-07-01", "2026-07-02", "2026-07-03"):
        assert S.worker_expected_hours({"hire_date": d}, 2026, 7, hol, 8, std) == std, d
    # 4일 입사 → 재직 28일 → 비례 (만근 아님)
    h4 = S.worker_expected_hours({"hire_date": "2026-07-04"}, 2026, 7, hol, 8, std)
    assert h4 == round(std * 28 / 31, 1)
    assert h4 < std
    # 휴직은 만근 처리와 무관하게 재직일수에서 차감
    w = {"hire_date": "2026-07-01", "leaves": [{"start": "2026-07-16", "end": "2026-07-31"}]}
    assert S.worker_expected_hours(w, 2026, 7, hol, 8, std) == round(std * 15 / 31, 1)


def test_13_leave_excluded():
    """휴직 기간은 재직일수에서 차감된다."""
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]
    full = {"hire_date": "2025-01-01"}
    allmonth = {"hire_date": "2025-01-01", "leaves": [{"start": "2026-07-01", "end": "2026-07-31"}]}
    assert S.worker_expected_hours(full, 2026, 7, hol, 8, std) == std
    assert S.worker_expected_hours(allmonth, 2026, 7, hol, 8, std) == 0


def test_14_placement_ratio_21():
    """배치비율 2.1:1 — 경계값 판정."""
    assert S.DEFAULT_CONFIG["placement_ratio"] == 2.1
    assert S.calculate_required_worker_count(18.9, 2.1) == 9    # 9 × 2.1 = 18.9 (경계)
    assert S.calculate_required_worker_count(18.91, 2.1) == 10  # 초과 → 10명
    assert S.calculate_required_worker_count(21.0, 2.1) == 10   # 10 × 2.1 = 21.0 (경계)
    assert S.calculate_required_worker_count(21.01, 2.1) == 11


def test_15_fte_from_hours_rule():
    """정규환산인원(FTE) — 월기준시간 채운 사람 1명 + 못 채운 사람은 시간 합산 ÷ 월기준시간."""
    fte = S.calculate_fte_from_hours([200, 80, 80], 160)
    assert fte["full_time_count"] == 1
    assert fte["partial_worker_count"] == 2
    assert fte["partial_hours_total"] == 160
    assert fte["partial_fte"] == 1.0
    assert fte["fte_total"] == 2.0
    # 경계값: 정확히 기준시간이면 '넘은' 쪽(1명)으로 센다
    assert S.calculate_fte_from_hours([160.0], 160)["full_time_count"] == 1
    assert S.calculate_fte_from_hours([159.9], 160)["full_time_count"] == 0
    # 0시간(퇴사 등)은 부분근무에도 안 들어간다 — 아예 없는 사람 취급
    fte0 = S.calculate_fte_from_hours([160, 0, 0], 160)
    assert fte0["partial_worker_count"] == 0 and fte0["fte_total"] == 1.0
    # 기준시간 0이면 계산이 죽지 않고 전부 0
    assert S.calculate_fte_from_hours([100, 200], 0)["fte_total"] == 0.0


def test_16_hours_priority_manual_over_schedule():
    """관리자가 직접 고친 값(recognized_work_hours)이 실제 근무표(schedule_hours)보다 항상 이긴다."""
    hol = set(S.get_korean_holidays(2026).keys())
    std = S.calculate_monthly_standard_hours(2026, 7, hol, 8)["hours"]
    w = {"hire_date": "2020-01-01", "schedule_hours": 140.0, "recognized_work_hours": 99.0}
    assert S.worker_expected_hours(w, 2026, 7, hol, 8, std) == 99.0
    # 수동 조정이 없으면 실제 근무표 값을 쓴다 (달력일수 추정치보다 우선)
    w2 = {"hire_date": "2020-01-01", "schedule_hours": 140.0}
    assert S.worker_expected_hours(w2, 2026, 7, hol, 8, std) == 140.0
    # 근무표도 없으면 그제서야 재직일수 비례 추정치
    w3 = {"hire_date": "2020-01-01"}
    assert S.worker_expected_hours(w3, 2026, 7, hol, 8, std) == std


def test_17_next_month_projection_ceils_fractional_fte():
    """FTE(소수)가 필요인원보다 모자라면 부족분을 사람 단위로 올림한다."""
    hol = set(S.get_korean_holidays(2026).keys())
    proj = S.calculate_next_month_projection(
        residents=[{"admission_date": "2026-06-01"} for _ in range(10)],
        planned=[], year=2026, month=6,
        current_worker_count=3.4, config=S.DEFAULT_CONFIG, holidays_next=hol)
    # 필요 = ceil(10/2.1) = 5, 확보 3.4 → 부족 1.6 → 올림 2명
    assert proj["required_worker_count"] == 5
    assert proj["additional_full_time_workers"] == 2
    # 충분하면 0
    proj2 = S.calculate_next_month_projection(
        residents=[{"admission_date": "2026-06-01"} for _ in range(4)],
        planned=[], year=2026, month=6,
        current_worker_count=3.0, config=S.DEFAULT_CONFIG, holidays_next=hol)
    assert proj2["additional_full_time_workers"] == 0


def test_18_additional_admittable_residents():
    """지금 인력만으로 어르신을 몇 분 더 받을 수 있는지 — simulate() 출력."""
    from datetime import date
    y, m = date.today().year, date.today().month
    # 요양보호사 2명이 각각 기준시간을 꽉 채워 근무 중(실제 근무표 값으로 가정)
    std_probe = S.simulate({"year": y, "month": m, "residents": [], "workers": [],
                            "planned_admissions": [], "candidates": []})["monthly_standard_hours"]
    workers = [{"name": "A", "schedule_hours": std_probe}, {"name": "B", "schedule_hours": std_probe}]
    residents = [{"admission_date": f"{y}-{m:02d}-01"} for _ in range(2)]  # 월평균 2명
    out = S.simulate({"year": y, "month": m, "residents": residents, "workers": workers,
                      "planned_admissions": [], "candidates": []})
    # FTE 2.0 × 배치비율 2.1 = 관리가능 4.2명, 현재 2명 → 더 받을 수 있는 어르신은 floor(2.2)=2명
    assert out["current_worker_count"] == 2.0
    assert out["additional_admittable_residents"] == 2
    assert "더 받을 수 있을 것으로 예상됩니다" in out["recommendation"]


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
