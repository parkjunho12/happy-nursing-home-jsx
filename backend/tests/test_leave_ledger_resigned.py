"""연차 대장에 퇴사자를 함께 볼 때의 규칙.

퇴사자를 대장에 띄우는 이유는 대개 하나다 — '그만둘 때 연차 정산이 맞았나'.
그래서 두 가지가 맞아야 쓸모가 있다.

  1. 그 해에 하루라도 재직했던 사람만 나온다.
     2년 전에 그만둔 사람이 올해 대장에 0으로 줄만 차지하면, 정작 지금
     챙겨야 할 사람이 묻힌다.

  2. 발생 일수가 퇴사한 달에서 멈춘다.
     3월에 그만둔 사람이 8월치까지 발생한 것처럼 보이면 그 숫자를 볼 이유가
     없다. 정산이 맞았는지 확인하려고 폈는데 틀린 답을 주는 셈이다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_leave_ledger_resigned.py
"""
from __future__ import annotations

import sys
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent
       / "app" / "api" / "v1" / "endpoints" / "leave.py").read_text(encoding="utf-8")


def _fn(name: str, start: str, end: str):
    ns: dict = {}
    exec(SRC[SRC.index(start):SRC.index(end)], ns)
    return ns[name]


class Staff:
    def __init__(self, hire, resign=None, status="resigned"):
        self.hire_date, self.resign_date, self.status = hire, resign, status


def check() -> int:
    worked = _fn("_worked_in_year", "def _worked_in_year", '@router.get("/ledger")')
    accrue = _fn("_accrued_first_year", "def _first_accrual_month", "\ndef _hr_viewer")
    bad: list[str] = []

    # ── 1. 그 해에 재직했던 사람만 ──────────────────────────────────
    for label, st, year, want in [
        ("재직자",                    Staff("2020-01-01", None, "active"), 2026, True),
        ("그 해 3월 퇴사",            Staff("2020-01-01", "2026-03-15"),   2026, True),
        ("작년 11월 퇴사 → 올해",     Staff("2020-01-01", "2025-11-30"),   2026, False),
        ("작년 11월 퇴사 → 작년",     Staff("2020-01-01", "2025-11-30"),   2025, True),
        ("내년 입사예정",             Staff("2027-02-01", None),           2026, False),
        ("1월 1일 퇴사(하루 재직)",   Staff("2020-01-01", "2026-01-01"),   2026, True),
        ("작년 마지막날 퇴사",        Staff("2020-01-01", "2025-12-31"),   2026, False),
        # 날짜가 없거나 이상하면 넣는 쪽으로 — 대장에서 사람이 조용히 빠지는 것이
        # 잘못 들어가는 것보다 나쁘다. 빠지면 아무도 눈치채지 못한다.
        ("입사일 비어있음",           Staff("", None),                     2026, True),
        ("퇴사일이 날짜가 아님",      Staff("2020-01-01", "몰라"),         2026, True),
    ]:
        got = worked(st, year)
        if got is not want:
            bad.append(f"'{label}' {year}년: {want} 여야 하는데 {got}")

    # ── 2. 발생은 퇴사한 달에서 멈춘다 ──────────────────────────────
    # 1년차(입사 2026-01-01)가 3월에 퇴사 → 8월인 지금 기준으로 세면 안 된다
    hire = "2026-01-01"
    at_march = accrue(hire, 2026, 3)
    at_august = accrue(hire, 2026, 8)
    if not at_march < at_august:
        bad.append(f"달이 늘면 발생도 늘어야 한다 (3월 {at_march} / 8월 {at_august})")
    # 퇴사 달로 자른 값이 그 달 기준값과 같아야 한다
    if accrue(hire, 2026, min(8, 3)) != at_march:
        bad.append("퇴사 달로 자른 발생이 그 달 기준과 다르다")
    # 작년에 퇴사한 사람은 올해 발생이 없다
    if accrue(hire, 2026, 0) != 0:
        bad.append(f"작년 퇴사자의 올해 발생은 0 이어야 하는데 {accrue(hire, 2026, 0)}")

    if bad:
        print("❌ 퇴사자 연차 대장 규칙이 어긋납니다 — 정산 확인에 쓰는 숫자입니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print("✅ 퇴사자 연차 대장 정상 — 재직연도 판정 9건 · 발생 상한 3건")
    return 0


def test_ledger_resigned():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
