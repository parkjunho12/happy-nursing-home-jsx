"""근무시간 계산이 화면과 같은지 확인한다.

총시간은 화면(TypeScript)에서 계산해 저장할 때 함께 담고, 엑셀은 그 값을
읽는다. 다만 이 기능이 생기기 전에 저장된 달에는 그 값이 없어, 그때는
백엔드가 직접 계산한다. 그래서 같은 규칙이 두 곳에 있다.

같은 계산이 두 곳에 있으면 언젠가 어긋난다. 그때 어느 쪽이 맞는지 아무도
모르고, 이건 급여로 이어지는 숫자다.

그래서 검증표(app/data/shift_hours_fixture.json)를 하나 두고 양쪽이 같은
표를 통과하게 한다. 그 표는 화면 구현에서 뽑아낸 것이다.
  · 이 파일이 백엔드 쪽을 확인한다 (배포 워크플로에서 돈다)
  · apps/admin/tests/shiftHoursMirror.test.ts 가 화면 쪽을 확인한다
누가 한쪽 규칙을 바꾸면 그쪽 테스트가 먼저 깨진다. 표를 고치면 반대쪽이
깨진다. 한쪽만 조용히 바뀌는 길이 없다.

의존성 없이 돌아야 한다(CI 에 pytest 가 없다). 그래서 파일 경로로 직접
불러오고, 그냥 실행해도 되게 만들었다.

    python3 backend/tests/test_shift_hours.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
FIXTURE = BACKEND / "app" / "data" / "shift_hours_fixture.json"
MODULE = BACKEND / "app" / "services" / "shift_hours.py"


def _load():
    """앱 패키지를 통째로 끌어오지 않고 이 모듈만 불러온다."""
    spec = importlib.util.spec_from_file_location("shift_hours", MODULE)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def check() -> int:
    sh = _load()
    fx = json.loads(FIXTURE.read_text(encoding="utf-8"))
    bad: list[str] = []

    for c in fx["cases"]:
        h = sh.hours_of(c["input"])
        e = sh.extra_hours_of(c["input"])
        if abs(h - c["hours"]) > 1e-9 or abs(e - c["extra"]) > 1e-9:
            bad.append(f"{c['input']!r}: 화면 hours={c['hours']} extra={c['extra']} / "
                       f"백엔드 hours={h} extra={e}")

    for b in fx["breaks"]:
        got = sh.break_minutes(b["span"])
        if got != b["brk"]:
            bad.append(f"휴게 {b['span']}분: 화면 {b['brk']} / 백엔드 {got}")

    # 한 달 합계도 한 번 — 낱개가 맞아도 더하는 곳에서 틀릴 수 있다
    days = list(range(1, 32))
    total = sh.month_total({"1": "D", "2": "N", "3": "休", "4": "0850 1600", "5": ""}, days)
    if abs(total - (8 + 9 + 8 + 6)) > 1e-9:
        bad.append(f"한 달 합계: 31.0 이어야 하는데 {total}")

    # 그 달에 없는 날짜는 세지 않는다
    feb = list(range(1, 29))
    if abs(sh.month_total({"28": "D", "31": "D"}, feb) - 8) > 1e-9:
        bad.append("2월에 31일을 셌다")

    # 설정으로 바꿨을 때도 화면과 같은 방식으로 동작해야 한다.
    # (화면 쪽은 apps/admin/tests/shiftHoursMirror.test.ts 가 같은 것을 본다)
    if abs(sh.hours_of("N", {"N": 10}) - 10) > 1e-9:
        bad.append("설정으로 바꾼 값이 반영되지 않는다")
    if abs(sh.hours_of("D", {"N": 10}) - 8) > 1e-9:
        bad.append("안 바꾼 코드가 함께 바뀐다")
    for junk in ({"없는코드": 8}, {"N": "abc"}, {"N": None}):
        if abs(sh.hours_of("N", junk) - 9) > 1e-9:
            bad.append(f"말이 안 되는 설정을 무시하지 않는다: {junk}")
    if abs(sh.month_total({"1": "N", "2": "D"}, days, {"N": 10}) - 18) > 1e-9:
        bad.append("합계에 설정이 반영되지 않는다")

    # 시점 설정 — apps/admin/tests/shiftHoursMirror.test.ts 와 같은 사례.
    # 화면과 백엔드가 같은 순서로 풀어야 한다. 한쪽만 다르게 풀면 근무표와
    # 급여 대장의 숫자가 달라지고, 그건 지난달 급여를 다시 계산하는 일이 된다.
    RULES = [
        {"from": "2026-09", "hours": {"N": 10}},
        {"from": "2027-01", "hours": {"N": 10.5, "D": 8.5}},
    ]
    expect = [
        ("2026-07", "N", 9), ("2026-08", "N", 9),
        ("2026-09", "N", 10), ("2026-12", "N", 10),
        ("2027-06", "N", 10.5), ("2027-06", "D", 8.5),
        (None, "N", 9), ("", "N", 9),
    ]
    for mth, code, want in expect:
        got = sh.resolve_for_month(mth, None, RULES).get(code)
        if abs(float(got) - want) > 1e-9:
            bad.append(f"시점 {mth!r} {code}: {want} 여야 하는데 {got}")

    t = sh.resolve_for_month("2026-09", {"N": 9.5, "M": 7}, RULES)
    if abs(t["N"] - 10) > 1e-9:
        bad.append("시점이 전체 기간 설정을 이기지 못한다")
    if abs(t["M"] - 7) > 1e-9:
        bad.append("시점에 없는 코드가 전체 기간 값을 잃는다")

    junk = sh.resolve_for_month("2026-09", None, [
        {"from": "2026-09", "hours": {"없는코드": 3, "N": 99}}, "쓰레기", None])
    if abs(junk["N"] - 9) > 1e-9:
        bad.append("말이 안 되는 시점 규칙을 무시하지 않는다")

    if bad:
        print("❌ 화면과 어긋납니다 — 근무시간 규칙을 한쪽만 고치면 급여 숫자가 갈라집니다.")
        for b in bad:
            print("   ·", b)
        print("\n화면(apps/admin/src/utils/shiftCodes.ts)이 기준입니다.")
        print("규칙을 바꿨다면 검증표도 다시 뽑아 양쪽을 맞춰주세요.")
        return 1

    print(f"✅ 화면과 일치 — 입력 {len(fx['cases'])}개 · 휴게 {len(fx['breaks'])}개 · 합계 2건 · 설정 6건 · 시점 12건")
    return 0


def test_matches_frontend():
    """pytest 로도 돌게."""
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
