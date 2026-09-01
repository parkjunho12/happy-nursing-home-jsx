"""직원 평가 — 점수 검증과 기간 형식.

이건 재계약·급여로 이어질 수 있는 인사 기록이다. 조용히 틀리면 안 되는
두 가지를 못박아 둔다.

  1. 점수 범위 — 1~5 밖의 값이 저장되면 합계와 평균이 망가진다.
     화면에서 막는 것으로는 부족하다. API 를 직접 부르면 그만이다.

  2. 기간 형식 — '2026-H3' 같은 값이 저장되면 그 평가는 어느 화면에도
     다시 나타나지 않는다. 사라진 줄도 모른다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_staff_eval.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent
       / "app" / "api" / "v1" / "endpoints" / "staff_eval.py").read_text(encoding="utf-8")
MODEL = (Path(__file__).resolve().parent.parent
         / "app" / "models" / "staff_eval.py").read_text(encoding="utf-8")


def _env():
    ns = {"re": re}
    exec("class HTTPException(Exception):\n"
         "    def __init__(self, code, msg=''): self.code, self.msg = code, msg\n", ns)
    # 모델에서 항목·배점과 허용 범위를 꺼내 온다
    exec(MODEL[MODEL.index("EVAL_ITEMS = ["):MODEL.index("class StaffEvaluation")], ns)
    exec(MODEL[MODEL.index("MIN_ITEMS, MAX_ITEMS"):], ns)
    exec('PERIOD_RE = re.compile(r"^\\d{4}-H[12]$")\n'
         'KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,29}$")\nLABEL_MAX = 60\n', ns)
    exec(SRC[SRC.index("def _clean_items"):SRC.index("ITEM_KEYS =")], ns)
    exec(SRC[SRC.index("def _check_period"):SRC.index("def _view")], ns)
    return ns


def check() -> int:
    ns = _env()
    period = ns["_check_period"]
    items_of = ns["EVAL_ITEMS"]
    def scores(raw, its=None, mx=None):
        return ns["_clean_scores"](raw, its or items_of, mx or ns["MAX_SCORE"])
    clean_items = ns["_clean_items"]
    HTTPException = ns["HTTPException"]
    keys = [i["key"] for i in ns["EVAL_ITEMS"]]
    bad: list[str] = []

    # ── 항목 구성 ────────────────────────────────────────────────
    if len(keys) != 6:
        bad.append(f"항목이 6개여야 하는데 {len(keys)}개")
    if len(set(keys)) != len(keys):
        bad.append("항목 key 가 겹친다 — 점수가 덮어써진다")

    # ── 기간 형식 ────────────────────────────────────────────────
    for v, want in [("2026-H1", "2026-H1"), ("2026-h2", "2026-H2"), (" 2026-H1 ", "2026-H1")]:
        try:
            got = period(v)
        except HTTPException:
            got = "거부"
        if got != want:
            bad.append(f"기간 {v!r}: {want} 여야 하는데 {got}")
    for v in ("2026-H3", "2026", "26-H1", "", None, "2026-H0", "올해"):
        try:
            period(v); bad.append(f"기간 {v!r} 을 받아들였다 — 그 평가는 다시 안 보인다")
        except HTTPException:
            pass

    # ── 점수 범위 ────────────────────────────────────────────────
    k = keys[0]
    ok = scores({k: 3})
    if ok != {k: 3}:
        bad.append(f"정상 점수가 안 들어간다: {ok}")
    if scores({k: "4"}) != {k: 4}:
        bad.append("문자로 온 숫자를 못 받는다 — 화면이 문자열로 보낼 수 있다")
    for v in (0, 6, 99, -1, 5.5, None, "", "다섯", [3]):
        got = scores({k: v})
        if got:
            bad.append(f"말이 안 되는 점수 {v!r} 을 받아들였다 → {got}")
    # 5.5 는 int() 로 5가 되면 안 된다 — 반올림해 저장하면 원래 뜻이 사라진다
    if scores({k: 5.5}):
        bad.append("소수 점수를 잘라서 저장한다")

    # 모르는 항목은 버린다 — 옛 항목이 섞여 와도 합계가 어긋나지 않게
    if scores({"없는항목": 5}) != {}:
        bad.append("모르는 항목이 저장된다")
    mixed = scores({k: 4, "없는항목": 5, keys[1]: 9})
    if mixed != {k: 4}:
        bad.append(f"섞여 온 값을 제대로 못 거른다: {mixed}")

    # 빈 평가도 저장은 된다(중간 저장). 대신 합계를 믿으면 안 되므로
    # filled 로 몇 개 매겼는지 함께 본다 — 그건 _view 가 한다.
    if scores({}) != {}:
        bad.append("빈 점수에서 무언가 만들어진다")

    # ── 항목 설정 검증 ───────────────────────────────────────────
    ok = clean_items([{"key": "attitude", "label": "근무태도"}, {"label": "새 항목"}])
    if len(ok) != 2 or ok[0]["key"] != "attitude":
        bad.append(f"기존 key 를 지키지 못한다: {ok}")
    if not ok[1]["key"] or ok[1]["key"] == "attitude":
        bad.append("새 항목에 key 를 제대로 안 붙인다 — 지난 점수를 이어받은 것처럼 보인다")

    # 이름이 같아도 key 가 겹치면 안 된다. 겹치면 뒤엣것이 앞엣것을 덮어쓴다.
    dup = clean_items([{"key": "same", "label": "가"}, {"key": "same", "label": "나"}])
    if len({i["key"] for i in dup}) != 2:
        bad.append("같은 key 를 두 항목에 허용한다 — 점수가 덮어써진다")

    # 조용히 고쳐서 저장하지 않는다 — 적은 것과 다른 항목이 표에 나오면 안 된다
    for label, raw in [
        ("빈 목록",        []),
        ("항목 아님",      "항목"),
        ("이름이 빔",      [{"label": "  "}]),
        ("이름이 너무 김", [{"label": "가" * 61}]),
        ("항목이 너무 많음", [{"label": f"항목{i}"} for i in range(ns["MAX_ITEMS"] + 1)]),
        ("사전이 아님",    [["가"]]),
    ]:
        try:
            clean_items(raw)
            bad.append(f"잘못된 항목 설정을 받아들였다: {label}")
        except HTTPException:
            pass

    # ── 설정을 바꿔도 지난 평가는 그대로여야 한다 ─────────────────
    # 이게 이번 변경에서 가장 중요하다. 항목이나 배점을 바꿨다고 지난
    # 인사 기록의 뜻이 달라지면, 그건 기록을 고친 것과 같다.
    옛항목 = [{"key": "a", "label": "가"}, {"key": "b", "label": "나"}]
    옛평가 = scores({"a": 5, "b": 4}, 옛항목, 5)
    if 옛평가 != {"a": 5, "b": 4}:
        bad.append("옛 배점으로 매긴 점수를 못 읽는다")
    # 배점을 3으로 낮춘 뒤에도, 옛 평가는 옛 잣대(5점)로 읽혀야 한다
    if scores({"a": 5}, 옛항목, 5) != {"a": 5}:
        bad.append("배점을 낮추면 지난 5점이 사라진다 — 기록을 고치는 셈이다")
    # 다만 새 평가는 새 잣대를 따라야 한다
    if scores({"a": 5}, 옛항목, 3) != {}:
        bad.append("배점을 3으로 낮췄는데 새 평가에 5점이 들어간다")
    # 항목을 지우면 새 평가에는 그 항목이 안 들어간다
    if scores({"b": 3}, [{"key": "a", "label": "가"}], 5) != {}:
        bad.append("지운 항목의 점수가 새 평가에 들어간다")

    if bad:
        print("❌ 직원 평가 규칙이 어긋납니다 — 인사 기록의 숫자가 망가집니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print(f"✅ 직원 평가 정상 — 기본 항목 {len(keys)}개 · 기간 형식 10건 · "
          f"점수 범위 13건 · 항목 설정 9건 · 지난 평가 보존 4건")
    return 0


def test_staff_eval():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
