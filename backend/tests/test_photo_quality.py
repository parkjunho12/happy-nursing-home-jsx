"""블로그 사진 점수와 고르기 — 같은 활동 사진 중 좋은 것부터 쓰는가.

연달아 찍은 사진에는 흔들린 것, 역광으로 어두운 것, 축소 저장된 작은 것이
섞여 있다. 상한에 걸려 일부만 뽑을 때 그런 사진이 먼저 잡히면 블로그에
그대로 나간다 — 블로그는 시설의 얼굴이다.

  · 점수 합산(combine)이 '더 나은 쪽' 을 실제로 앞세우는가
  · 고르기(cluster→pick)가 같은 날짜 안에서 점수 높은 사진부터 잡는가
  · 점수를 아직 안 잰 사진(None)이 있어도 죽지 않는가

측정(_measure)은 PIL 이 필요해 여기서 다루지 않는다 — 합산과 고르기만
본다. 의존성 없이 돌아야 한다.  python3 backend/tests/test_photo_quality.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.photo_quality import combine  # noqa: E402
from app.services.blog_source import Candidate, cluster, pick  # noqa: E402

fails = []


def ok(cond, name):
    if not cond:
        fails.append(name)


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


GOOD = {"sharpness": 600.0, "brightness": 130.0, "contrast": 60.0,
        "width": 1600.0, "height": 1200.0, "face_area": 0.05}

# ── ① 합산 — 나쁜 조건 하나씩이 실제로 점수를 깎는가 ─────────────────────
base = combine(GOOD)
ok(base >= 90, f"좋은 사진은 높은 점수여야 합니다 (지금 {base})")

blurry = combine({**GOOD, "sharpness": 30.0})
ok(blurry < base, "흔들린 사진은 선명한 사진보다 낮아야 합니다")

dark = combine({**GOOD, "brightness": 25.0})
bright_burn = combine({**GOOD, "brightness": 245.0})
ok(dark < base, "어두운 사진은 낮아야 합니다")
ok(bright_burn < base, "하얗게 뜬 사진도 낮아야 합니다")

flat = combine({**GOOD, "contrast": 8.0})
ok(flat < base, "뿌연(대비 낮은) 사진은 낮아야 합니다")

tiny = combine({**GOOD, "width": 200.0, "height": 150.0})
ok(tiny < base, "작은 사진은 낮아야 합니다")

covered = combine({**GOOD, "face_area": 0.9})
ok(covered < base, "가림 상자가 화면을 덮으면 낮아야 합니다")
ok(combine({**GOOD, "face_area": 0.2}) == base, "가림이 적당하면 깎지 않습니다")

# 최악끼리 겹쳐도 0 밑으로 안 내려간다
worst = combine({"sharpness": 0, "brightness": 0, "contrast": 0,
                 "width": 0, "height": 0, "face_area": 1.0})
ok(0 <= worst <= 5, f"최악의 사진은 0 근처여야 합니다 (지금 {worst})")

# ── ② 고르기 — 같은 날짜 안에서 점수 높은 사진부터 ───────────────────────
def cand(pid, d, q):
    return Candidate(pid, "program", d, "맨손체조", "신체", None, None, False, quality=q)

cands = [
    cand("a-흔들림", "2026-09-10", 20.0),
    cand("b-선명", "2026-09-10", 90.0),
    cand("c-보통", "2026-09-10", 55.0),
    cand("d-안잼", "2026-09-10", None),     # 옛 사진 — 점수가 없다
    cand("e-선명", "2026-09-11", 80.0),
    cand("f-어두움", "2026-09-11", 15.0),
]
groups = cluster(cands)
eq(len(groups), 1, "같은 프로그램은 한 덩어리")
order = [c.photo_id for c in groups[0]["items"]]
eq(order[:4], ["b-선명", "c-보통", "a-흔들림", "d-안잼"],
   "같은 날짜 안에서는 점수 높은 것부터, 안 잰 것은 맨 뒤")
eq(order[4:], ["e-선명", "f-어두움"], "날짜 순서는 그대로")

# 상한(MAX_PHOTOS)에 걸리면 날짜마다 좋은 사진부터 잡히고 나쁜 것이 떨어진다
many = ([cand(f"d1-{q}", "2026-09-10", float(q)) for q in (90, 80, 70, 30, 20, 10)]
        + [cand(f"d2-{q}", "2026-09-11", float(q)) for q in (85, 60, 25, 5)])
picked = pick(cluster(many))
ok(picked is not None, "덩어리를 골라야 합니다")
got = {c.photo_id for c in picked["items"]}
eq(len(got), 8, "상한 8장")
ok({"d1-90", "d1-80", "d2-85", "d2-60"} <= got,
   f"각 날짜의 높은 점수가 먼저 잡혀야 합니다 (지금 {sorted(got)})")
# 날짜별로 고르게 나누는 것이 먼저다(같은 장면만 몰리지 않게) — 그래서
# 사진이 많은 날짜 안에서 점수 낮은 것부터 떨어진다
ok("d1-20" not in got and "d1-10" not in got,
   f"몫을 넘긴 날짜에서는 낮은 점수부터 떨어져야 합니다 (지금 {sorted(got)})")

# 점수가 하나도 없어도(전부 None) 죽지 않고 이전과 같은 순서로 돈다
legacy = [cand(f"p{i}", "2026-09-10", None) for i in range(5)]
g2 = cluster(legacy)
eq([c.photo_id for c in g2[0]["items"]], [f"p{i}" for i in range(5)],
   "점수가 없으면 이전처럼 id 순서")

if fails:
    print("❌ 사진 점수·고르기 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 사진 점수·고르기 정상 — 합산 9건 · 정렬 3건 · 상한 고르기 2건 · 점수 없음 1건")
