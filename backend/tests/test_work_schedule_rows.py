"""근무표 조 편성 이월 — 바꾼 편성이 다음 달로 따라가되, 따로 손본 달은 건드리지 않는다.

  ① 편성 비교는 직종·조·층만 본다. 순서는 화면 정렬에 따라 매번 바뀌고, 비고는
     그 달의 이야기이며, 총시간 같은 집계는 달마다 다르다.
  ② 저장 직전 편성과 같았던(따라오던) 뒤 달만 고른다. 다르게 짠 달은 뺀다.
     다음 달에만 있는 신규 입사자 때문에 '다르게 짠 달' 로 오해하면 안 된다.
     잠긴 달은 따로 알린다. 편성이 없는 달은 조회 때 물려받으니 건드리지 않는다.
  ③ 입힐 때 그 달의 집계 칸은 그대로 두고, 그 달에만 있는 사람은 남긴다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_work_schedule_rows.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import work_schedule_rows as R  # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def row(sid, team, floor="2층", order=0, note="", **extra):
    return {"staff_id": sid, "position": "요양보호사", "team": team, "floor": floor,
            "order": order, "note": note, **extra}


# ── ① 편성 비교 ───────────────────────────────────────────────────────────
a = [row("s1", "A조", hours=160), row("s2", "B조", order=1, hours=150)]
b = [row("s2", "B조", order=1, hours=170), row("s1", "A조", hours=0)]     # 집계·순서만 다름
eq(R.same_assignment(a, b), True, "집계가 달라도 같은 편성")
eq(R.same_assignment(a, [row("s1", "B조"), row("s2", "B조", order=1)]), False, "조가 다르면 다른 편성")
eq(R.same_assignment(a, [row("s1", "A조", floor="3층"), row("s2", "B조", order=1)]), False, "층이 다르면 다른 편성")
eq(R.same_assignment(a, a[:1]), False, "사람이 빠지면 다른 편성")
eq(R.same_assignment(a, [row("s2", "B조", order=0), row("s1", "A조", order=1)]), True, "이름순으로 정렬해 저장해도 같은 편성")
eq(R.same_assignment(a, [row("s1", "A조", note="9월 셋째 주 병가"), row("s2", "B조", order=1)]), True, "비고만 고친 것은 편성 변경이 아니다")
eq(R.same_assignment(a, [row("s1", "A조"), row("sNew", "A조", order=1), row("s2", "B조", order=2)]), False, "신규 입사자가 들어오면 다른 편성(순서가 밀려도 그 때문은 아니다)")
eq(R.same_assignment([row("s1", "A조", floor=None)], [row("s1", "A조", floor="")]), True, "빈 층은 None 과 같다")
eq(R.same_assignment([], None), True, "빈 편성끼리")

# ── ② 따라오던 달 고르기 ──────────────────────────────────────────────────
old = [row("s1", "A조"), row("s2", "B조", order=1)]
later = [
    ("2026-10", [row("s1", "A조", hours=160), row("s2", "B조", order=1, hours=120), row("sNew", "A조", order=2)], False),  # 따라오던 달 (+신규 입사자)
    ("2026-10b", [row("s1", "A조", hours=160)], False),                                    # 따라오던 달 (s2 퇴사)
    ("2026-11", [row("s1", "C조"), row("s2", "B조", order=1)], False),                       # 따로 손본 달
    ("2026-12", [], False),                                                                   # 편성 없음 — 조회 때 물려받음
    ("2027-01", [row("s1", "A조"), row("s2", "B조", order=1)], True),                        # 따라오던 달인데 잠김
]
todo, locked = R.follow_targets(old, later)
eq(todo, ["2026-10", "2026-10b"], "적을 달 — 사람이 드나든 것은 따로 짠 것이 아니다")
eq(locked, ["2027-01"], "잠겨서 못 적는 달")
eq(R.following(old, [row("s7", "A조")]), False, "겹치는 사람이 없으면 따라오던 것이 아니다")
eq(R.following(old, [row("s1", "A조"), row("s2", "C조", order=1)]), False, "같은 사람의 조가 다르면 따로 손본 달")
eq(R.follow_targets(None, [("2026-10", [row("s1", "A조")], False)]), ([], []), "이 달에 편성이 없었으면 아무도 따라오지 않았다")

# ── ③ 입히기 ──────────────────────────────────────────────────────────────
new = [row("s2", "B조", order=0, note="야간 전담"), row("s1", "C조", floor="3층", order=1), row("sNew", "A조", order=2)]
target = [row("s1", "A조", hours=160, total=170, note="10월 이야기"), row("s2", "B조", order=1, hours=120), row("s9", "주간", order=2, hours=80)]
out = R.apply_assignment(target, new)
by = {r["staff_id"]: r for r in out}
eq([r["staff_id"] for r in out], ["s1", "s2", "s9", "sNew"], "그 달의 줄 순서는 그대로, 새 사람은 끝에")
eq((by["s1"]["team"], by["s1"]["floor"], by["s1"]["hours"], by["s1"]["total"]), ("C조", "3층", 160, 170), "편성은 바뀌고 집계는 그대로")
eq((by["s1"]["note"], by["s2"].get("note")), ("10월 이야기", ""), "비고는 그 달 것을 지킨다")
eq(by["s9"]["team"], "주간", "다음 달에만 있는 사람은 남는다")
eq(sorted(by["sNew"].keys()), ["floor", "position", "staff_id", "team"], "새 사람 줄은 편성 칸만")
eq(R.apply_assignment(None, new)[0]["staff_id"], "s2", "빈 달에 입히면 새 편성 그대로")

# ── ④ 이월을 할 것인가 ────────────────────────────────────────────────────
eq(R.should_follow(new, old, None), True, "편성이 바뀌었고 화면이 말리지 않으면 한다")
eq(R.should_follow(new, old, False), False, "화면이 '이번 달만' 이라면 안 한다")
eq(R.should_follow(old, old, True), False, "편성이 그대로면 안 한다")
eq(R.should_follow([], old, True), False, "빈 편성 저장은 편성 변경이 아니다")
eq(R.should_follow(new, [], True), False, "저장 직전 편성이 없었으면 따라오던 달도 없다")

if fails:
    print("❌ 조 편성 이월 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 조 편성 이월 정상 — 비교 9건 · 고르기 5건 · 입히기 6건 · 판단 5건")
