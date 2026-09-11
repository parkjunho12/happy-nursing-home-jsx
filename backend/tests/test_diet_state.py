"""식이 — 그날 무엇을 드시는가, 그리고 주방에 몇 인분을 올리는가.

이 계산이 틀리면 어르신이 못 드시는 음식을 받는다. 삼킴이 어려워 죽으로
내려 드린 분께 일반식이 가면 사고다. 그래서 경계를 못박아 둔다.

  · 적용일 당일부터 새 식이다 (그 전날까지는 이전 식이)
  · 앞날에 예약해 둔 변경은 오늘 집계에 섞이지 않는다
  · 같은 날 두 번 고쳤으면 나중에 적은 것이 이긴다
  · 경관식은 밥·반찬을 세지 않는다 — 두 번 세면 주방이 더 만든다
  · 아무도 안 정해 준 분은 0이 아니라 '미정' 이다 — 빈칸은 빈칸이라 말해야 채운다

의존성 없이 돌아야 한다.  python3 backend/tests/test_diet_state.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import diet_state as ds          # noqa: E402
from app.services.diet_import import sheet_date    # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def ch(date, rice=None, side=None, tube=False, at="1"):
    return {"effective_date": date, "rice": rice, "side": side,
            "tube": tube, "created_at": at}


# ── ① 그날의 식이 ─────────────────────────────────────────────────────────
H = [ch("2026-05-01", "일반식", "일반찬"),
     ch("2026-08-18", "미음", "갈찬"),
     ch("2026-08-19", "죽", "갈찬")]

eq(ds.state_at(H, "2026-04-30"), None, "첫 기록보다 앞 — 아직 미정")
eq((ds.state_at(H, "2026-05-01") or {}).get("rice"), "일반식", "적용일 당일부터")
eq((ds.state_at(H, "2026-08-17") or {}).get("rice"), "일반식", "바뀌기 전날")
eq((ds.state_at(H, "2026-08-18") or {}).get("rice"), "미음", "바뀐 날")
eq((ds.state_at(H, "2026-08-19") or {}).get("rice"), "죽", "하루 만에 또 바뀜")
eq((ds.state_at(H, "2026-12-31") or {}).get("rice"), "죽", "그 뒤로는 계속")

# 앞날 예약이 오늘로 새면 안 된다 — 주방이 오늘 그걸 만든다
F = H + [ch("2026-09-20", "미음", "갈찬")]
eq((ds.state_at(F, "2026-09-11") or {}).get("rice"), "죽", "앞날 예약은 오늘에 안 섞인다")
eq((ds.next_change(F, "2026-09-11") or {}).get("effective_date"), "2026-09-20", "다음 예정")
eq(ds.next_change(F, "2026-12-31"), None, "예정 없음")

# 같은 날 두 번 고쳤으면 나중에 적은 것
S = [ch("2026-09-11", "죽", "다진찬", at="10:00"),
     ch("2026-09-11", "미음", "갈찬", at="15:00")]
eq((ds.state_at(S, "2026-09-11") or {}).get("rice"), "미음", "같은 날 두 번 — 나중 것")

# ── ② 주방에 올릴 숫자 ────────────────────────────────────────────────────
STATES = [
    {"rice": "일반식", "side": "일반찬", "tube": False},
    {"rice": "일반식", "side": "다진찬", "tube": False},
    {"rice": "죽", "side": "다진찬", "tube": False},
    {"rice": "미음", "side": "갈찬", "tube": False},
    {"rice": None, "side": None, "tube": True},        # 경관식
    None,                                              # 아무도 안 정해 줌
]
c = ds.counts(STATES)
eq(c["일반식"], 2, "일반식")
eq(c["죽"], 1, "죽")
eq(c["미음"], 1, "미음")
eq(c["당뇨식"], 0, "당뇨식 — 쓰지 않아도 칸은 있다")
eq(c["일반찬"], 1, "일반찬")
eq(c["다진찬"], 2, "다진찬")
eq(c["갈찬"], 1, "갈찬")
eq(c["경관식"], 1, "경관식")
eq(c["미정"], 1, "미정")
eq(c["합계"], 6, "합계")
# 경관식이 밥·반찬에도 세어지면 주방이 더 만든다
eq(sum(c[k] for k in ds.RICE_TYPES), 4, "밥 합계는 경관식·미정을 빼고 4")
eq(sum(c[k] for k in ds.SIDE_TYPES), 4, "반찬 합계도 4")

# 밥만 정하고 반찬을 안 정한 경우 — 미정으로 세지 않는다(밥은 정해졌다)
half = ds.counts([{"rice": "죽", "side": None, "tube": False}])
eq((half["죽"], half["미정"]), (1, 0), "밥만 정해진 분")

# ── ③ 값 검사 ─────────────────────────────────────────────────────────────
for v, want in [("일반식", True), ("당뇨식", True), ("죽", True), ("미음", True),
                (None, True), ("라면", False), ("일반찬", False), ("", False)]:
    eq(ds.valid_rice(v), want, f"밥 값 검사 {v!r}")
for v, want in [("일반찬", True), ("다진찬", True), ("갈찬", True),
                (None, True), ("죽", False), ("무침", False)]:
    eq(ds.valid_side(v), want, f"반찬 값 검사 {v!r}")

# ── ④ 이력에 적히는 말 ────────────────────────────────────────────────────
eq(ds.diff(None, {"rice": "일반식", "side": "일반찬"}), ["미정 → 일반식 · 일반찬"], "첫 기록")
eq(ds.diff({"rice": "일반식", "side": "일반찬"}, {"rice": "죽", "side": "다진찬"}),
   ["일반식 · 일반찬 → 죽 · 다진찬"], "바뀐 말")
eq(ds.diff({"rice": "죽", "side": "갈찬"}, {"rice": "죽", "side": "갈찬"}), [], "안 바뀌면 빈 것")
eq(ds.diff({"rice": "죽", "side": "갈찬"}, {"tube": True}), ["죽 · 갈찬 → 경관식"], "경관식으로")

# ── ⑤ 엑셀 시트 이름 = 날짜 ───────────────────────────────────────────────
for name, want in [("26.09.07", "2026-09-07"), ("26.8.21", "2026-08-21"),
                   ("26.04.14", "2026-04-14"),
                   ("26.07월식수현황", None), ("일일식수표", None),
                   ("26.13.01", None), ("26.09.32", None), ("", None)]:
    eq(sheet_date(name), want, f"시트 이름 {name!r}")

if fails:
    print("❌ 식이 계산 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print(f"✅ 식이 계산 정상 — 시점 판정 9건 · 집계 13건 · 값 검사 14건 "
      f"· 이력 문구 4건 · 시트 이름 8건")
