"""식이 현황의 「외박」 표시 — 케어포 외박 기록을 그날·지금 기준으로 읽는다.

틀린 사람에게 '외박중' 이 붙으면 그분 밥이 안 올라간다. 그래서 경계를 못박는다.

  · 외박만. 외출·병원외출은 표시하지 않는다
  · 이름은 공백 정규화 후 완전 일치만 — 비슷한 이름·동명이인은 아무에게도 안 붙인다
  · 오늘: 출발 전이면 '외박예정', 돌아온 뒤면 '외박·복귀', 그 사이 '외박중'
  · 지난 날: 그날 돌아왔으면 '외박·복귀', 아니면 '외박중'
  · 앞날: 모두 '외박예정'
  · 달이 바뀌어도 걸친 기록은 잡힌다
  · 일정표 귀원 기록이 케어포와 어긋나면 conflict 만 켠다 — 표시는 케어포를 따른다
  · 취소된 일정은 없는 것

의존성 없이 돌아야 한다.  python3 backend/tests/test_diet_absence.py
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import diet_absence as da  # noqa: E402

KST = da.KST
UTC = timezone.utc


def leave(name, start_date, start_time=None, end_date=None, end_time=None,
          leave_type="외박", code=None, rid=None, raw=None, updated=None):
    return NS(resident_name=name, resident_code=code, resident_id=rid,
              leave_type=leave_type, start_date=start_date, start_time=start_time,
              end_date=end_date, end_time=end_time, raw_data=raw,
              created_at=updated, updated_at=updated)


def event(title, start_kst, returned_kst=None, category="외박", status="scheduled"):
    """일정표 행. DB 는 UTC 로 저장하므로 UTC 로 넘겨 변환까지 시험한다."""
    return NS(title=title, category=category, status=status,
              start_at=start_kst.astimezone(UTC),
              returned_at=returned_kst.astimezone(UTC) if returned_kst else None)


def resident(rid, name, code=None):
    return NS(id=rid, name=name, resident_code=code)


def k(y, m, d, hh=0, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=KST)


# 가상 검증 상황(2026-09-21): 가상가 09/10 07:40 출발·복귀 미기록, 가상나 09/15 12:20 출발·복귀 미기록.
# 일정표는 둘 다 09/20 08:58 귀원으로 적혀 있다 (가상가 제목은 이름만, 가상나는 15:00 출발로 시각 다름).
R = [resident("r1", "가상가"), resident("r2", "가상나"), resident("r3", "가 상다"), resident("r4", "가상라")]
L_NOW = [leave("가상가", "2026-09-10", "07:40"), leave("가상나", "2026-09-15", "12:20")]
E_NOW = [event("가상가", k(2026, 9, 10, 7, 40), k(2026, 9, 20, 8, 58)),
         event("[외박] 가상나 어르신", k(2026, 9, 15, 15, 0), k(2026, 9, 20, 8, 58))]
NOW = k(2026, 9, 21, 10, 0)


def test_ongoing_today_carefor_based_with_conflict():
    out = da.build(R, L_NOW, E_NOW, "2026-09-21", NOW)
    a = out["r1"]
    assert a["label"] == "외박중" and a["source"] == "케어포"
    assert a["start_date"] == "2026-09-10" and a["start_time"] == "07:40"
    assert a["end_date"] is None and a["end_time"] is None
    assert a["conflict"] is True
    assert "귀원기록상이" in a["conflict_message"]
    assert "9/20 08:58" in a["conflict_message"] and "복귀 미기록" in a["conflict_message"]
    # 가상나 — 일정 출발 시각(15:00)이 케어포(12:20)와 달라도 같은 날짜면 짝이다
    b = out["r2"]
    assert b["label"] == "외박중" and b["conflict"] is True
    # 기록 없는 분들은 None — 열쇠는 있고 값은 비어 있다 (프론트가 .absence 를 안심하고 읽는다)
    assert out["r3"] is None and out["r4"] is None
    assert set(out) == {"r1", "r2", "r3", "r4"}


def test_conflict_not_raised_for_days_both_sides_agree():
    # 09/15 을 되감아 보면: 케어포도 일정표도 '그날 안 계셨다' — 어긋남 아님
    out = da.build(R, L_NOW, E_NOW, "2026-09-15", NOW)
    assert out["r1"]["label"] == "외박중" and out["r1"]["conflict"] is False
    assert "conflict_message" not in out["r1"]
    # 09/20 — 일정표는 그날 귀원, 케어포는 아직 → 어긋남
    out = da.build(R, L_NOW, E_NOW, "2026-09-20", NOW)
    assert out["r1"]["label"] == "외박중" and out["r1"]["conflict"] is True


def test_no_conflict_when_no_returned_at():
    ev = [event("가상가", k(2026, 9, 10, 7, 40), None)]
    out = da.build(R, L_NOW, ev, "2026-09-21", NOW)
    assert out["r1"]["label"] == "외박중" and out["r1"]["conflict"] is False


def test_conflict_when_return_dates_differ():
    lv = [leave("가상가", "2026-09-10", "07:40", "2026-09-21", "09:00")]
    out = da.build(R, lv, E_NOW, "2026-09-21", NOW)
    a = out["r1"]
    assert a["label"] == "외박·복귀"          # 케어포 기준: 오늘 09:00 복귀, 지금 10:00
    assert a["conflict"] is True
    assert "케어포 복귀 9/21 09:00" in a["conflict_message"]


def test_cancelled_schedule_is_ignored():
    ev = [event("가상가", k(2026, 9, 10, 7, 40), k(2026, 9, 20, 8, 58), status="canceled"),
          event("가상가", k(2026, 9, 10, 7, 40), k(2026, 9, 20, 8, 58), status="cancelled")]
    out = da.build(R, L_NOW, ev, "2026-09-21", NOW)
    assert out["r1"]["conflict"] is False


def test_schedule_other_category_or_other_day_not_matched():
    ev = [event("가상가", k(2026, 9, 10, 7, 40), k(2026, 9, 20, 8, 58), category="외출"),
          event("가상가", k(2026, 9, 11, 7, 40), k(2026, 9, 20, 8, 58))]   # 다른 출발일
    out = da.build(R, L_NOW, ev, "2026-09-21", NOW)
    assert out["r1"]["conflict"] is False


def test_month_boundary_and_prior_month_start():
    lv = [leave("가상라", "2026-08-28", "11:50", "2026-09-03", "15:40")]
    for on, label in (("2026-08-28", "외박중"), ("2026-08-31", "외박중"),
                      ("2026-09-01", "외박중"), ("2026-09-03", "외박·복귀")):
        out = da.build(R, lv, [], on, NOW)
        assert out["r4"]["label"] == label, (on, out["r4"])
    assert da.build(R, lv, [], "2026-09-04", NOW)["r4"] is None
    assert da.build(R, lv, [], "2026-08-27", NOW)["r4"] is None
    assert da.earliest_start(lv).isoformat() == "2026-08-28"


def test_historical_return_day_is_partial_label():
    lv = [leave("가상라", "2026-07-04", "11:50", "2026-07-15", "15:40")]
    assert da.build(R, lv, [], "2026-07-15", NOW)["r4"]["label"] == "외박·복귀"
    assert da.build(R, lv, [], "2026-07-10", NOW)["r4"]["label"] == "외박중"
    assert da.build(R, lv, [], "2026-07-16", NOW)["r4"] is None


def test_today_return_uses_current_time():
    lv = [leave("가상라", "2026-09-19", "10:00", "2026-09-21", "14:00")]
    assert da.build(R, lv, [], "2026-09-21", k(2026, 9, 21, 10, 0))["r4"]["label"] == "외박중"
    assert da.build(R, lv, [], "2026-09-21", k(2026, 9, 21, 14, 0))["r4"]["label"] == "외박·복귀"
    assert da.build(R, lv, [], "2026-09-21", k(2026, 9, 21, 18, 0))["r4"]["label"] == "외박·복귀"


def test_same_day_planned_departure_not_shown_as_away_yet():
    lv = [leave("가상라", "2026-09-21", "15:00")]
    assert da.build(R, lv, [], "2026-09-21", k(2026, 9, 21, 10, 0))["r4"]["label"] == "외박예정"
    assert da.build(R, lv, [], "2026-09-21", k(2026, 9, 21, 15, 0))["r4"]["label"] == "외박중"
    # 출발 시각이 비어 있으면 00:00 출발로 본다 — 오늘이면 이미 나가신 것
    assert da.build(R, [leave("가상라", "2026-09-21", None)], [], "2026-09-21",
                    k(2026, 9, 21, 10, 0))["r4"]["label"] == "외박중"


def test_future_dates_are_planned_not_actual():
    # 진행 중인 외박도 앞날을 보면 '예정' 이다 — 그날 안 계실지는 아직 사실이 아니다
    out = da.build(R, L_NOW, [], "2026-09-25", NOW)
    assert out["r1"]["label"] == "외박예정" and out["r2"]["label"] == "외박예정"
    lv = [leave("가상라", "2026-09-30", "10:00", "2026-10-02", "16:00")]
    assert da.build(R, lv, [], "2026-10-01", NOW)["r4"]["label"] == "외박예정"
    assert da.build(R, lv, [], "2026-09-29", NOW)["r4"] is None   # 출발 전날엔 없음


def test_timezone_now_in_utc_rolls_to_kst_day():
    # UTC 21일 23:30 = KST 22일 08:30 → '오늘' 은 22일
    now_utc = datetime(2026, 9, 21, 23, 30, tzinfo=UTC)
    lv = [leave("가상라", "2026-09-22", "10:00")]
    assert da.build(R, lv, [], "2026-09-22", now_utc)["r4"]["label"] == "외박예정"
    # KST 로 '지금' 이 21일이라면 22일 보기는 앞날 → 예정
    assert da.build(R, lv, [], "2026-09-22", k(2026, 9, 21, 23, 30))["r4"]["label"] == "외박예정"
    # naive 는 KST 로 본다
    assert da.build(R, lv, [], "2026-09-22", datetime(2026, 9, 22, 11, 0))["r4"]["label"] == "외박중"
    # 일정표 UTC 저장값이 KST 로 다음날이 되는 경계: 09/09 22:40Z == 09/10 07:40 KST
    ev = [NS(title="가상가", category="외박", status="scheduled",
             start_at=datetime(2026, 9, 9, 22, 40, tzinfo=UTC),
             returned_at=datetime(2026, 9, 19, 23, 58, tzinfo=UTC))]
    a = da.build(R, L_NOW, ev, "2026-09-21", NOW)["r1"]
    assert a["conflict"] is True and "9/20 08:58" in a["conflict_message"]


def test_only_overnight_type_counts():
    lv = [leave("가상라", "2026-09-21", "09:00", None, None, leave_type="외출"),
          leave("가상가", "2026-09-21", "09:00", None, None, leave_type="병원외출"),
          leave("가상나", "2026-09-21", "09:00", None, None, leave_type="기타")]
    out = da.build(R, lv, [], "2026-09-21", k(2026, 9, 21, 12, 0))
    assert all(v is None for v in out.values())
    # 공백이 섞인 유형은 외박으로 읽힌다
    assert da.is_overnight(leave("x", "2026-01-01", leave_type=" 외박 "))


def test_whitespace_normalised_names_match_exactly():
    lv = [leave("가상다", "2026-09-19", "13:00")]
    out = da.build(R, lv, [], "2026-09-21", NOW)
    assert out["r3"]["label"] == "외박중"
    lv = [leave("가\u3000상다", "2026-09-19", "13:00")]
    assert da.build(R, lv, [], "2026-09-21", NOW)["r3"]["label"] == "외박중"
    assert da.schedule_title_name("[외박] 가 상다 어르신") == "가상다"
    assert da.schedule_title_name("가상가") == "가상가"
    assert da.schedule_title_name("[외박] 가상나 어르신") == "가상나"
    assert da.schedule_title_name("가상가G 갱신") != "가상가"


def test_different_or_similar_names_never_attributed():
    lv = [leave("가상각", "2026-09-10", "07:40"),      # 한 글자 다름
          leave("가상", "2026-09-15", "12:20"),        # 앞부분만 같음
          leave("가상라2", "2026-09-15", "12:20")]
    out = da.build(R, lv, [], "2026-09-21", NOW)
    assert all(v is None for v in out.values())


def test_double_names_among_residents_attribute_to_nobody():
    rs = [resident("a", "가상라"), resident("b", "가 상라"), resident("c", "가상가")]
    lv = [leave("가상라", "2026-09-19", "10:00"), leave("가상가", "2026-09-10", "07:40")]
    out = da.build(rs, lv, [], "2026-09-21", NOW)
    assert out["a"] is None and out["b"] is None
    assert out["c"]["label"] == "외박중"


def test_double_names_on_carefor_side_are_ambiguous():
    rs = [resident("a", "가상라")]
    lv = [leave("가상라", "2026-09-19", "10:00", code="C-1"),
          leave("가상라", "2026-09-01", "10:00", "2026-09-02", "10:00", code="C-2")]
    assert da.build(rs, lv, [], "2026-09-21", NOW)["a"] is None
    # 코드가 어르신 쪽에도 있으면 코드로 바로 맞춘다 — 동명이인이어도
    rs = [resident("a", "가상라", code="C-1"), resident("b", "가상라", code="C-2")]
    out = da.build(rs, lv, [], "2026-09-21", NOW)
    assert out["a"]["label"] == "외박중" and out["b"] is None


def test_latest_departure_wins_when_records_overlap():
    lv = [leave("가상라", "2026-09-01", "10:00"),             # 옛 기록, 복귀 미기록(누락)
          leave("가상라", "2026-09-19", "10:00")]
    a = da.build(R, lv, [], "2026-09-21", NOW)["r4"]
    assert a["start_date"] == "2026-09-19"


def test_observed_at_from_raw_or_saved_time_and_no_phi():
    lv = [leave("가상라", "2026-09-19", "10:00",
                raw={"capturedAt": "2026-09-21T07:49:00+09:00", "동행보호자": "X (아들, [전화번호])"})]
    a = da.build(R, lv, [], "2026-09-21", NOW)["r4"]
    assert a["observed_at"] == "2026-09-21T07:49:00+09:00"
    assert set(a) <= {"label", "source", "start_date", "start_time", "end_date", "end_time",
                      "conflict", "conflict_message", "observed_at"}
    lv = [leave("가상라", "2026-09-19", "10:00", updated=datetime(2026, 9, 21, 7, 49, tzinfo=KST))]
    assert da.build(R, lv, [], "2026-09-21", NOW)["r4"]["observed_at"] == "2026-09-21T07:49:00+09:00"
    lv = [leave("가상라", "2026-09-19", "10:00")]
    assert "observed_at" not in da.build(R, lv, [], "2026-09-21", NOW)["r4"]


def test_bad_dates_are_ignored_quietly():
    lv = [leave("가상라", "2026.09.19", "10:00"), leave("가상라", None, "10:00"), leave("가상라", "", None)]
    assert da.build(R, lv, [], "2026-09-21", NOW)["r4"] is None
    assert da.earliest_start(lv) is None


def test_same_return_day_different_times_are_flagged():
    lv = [leave("가상가", "2026-09-10", "07:40", "2026-09-21", "19:00")]
    ev = [event("가상가", k(2026, 9, 10, 7, 40), k(2026, 9, 21, 8, 58))]
    a = da.build(R, lv, ev, "2026-09-21", NOW)["r1"]
    assert a["label"] == "외박중" and a["conflict"] is True


def test_invalid_calendar_date_does_not_hide_other_residents():
    lv = L_NOW + [leave("가상라", "2026-02-31", "07:40")]
    out = da.build(R, lv, E_NOW, "2026-09-21", NOW)
    assert out["r1"]["label"] == "외박중"
    assert out["r4"] is None


if __name__ == "__main__":
    fns = [v for k_, v in sorted(globals().items()) if k_.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"ok   {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
