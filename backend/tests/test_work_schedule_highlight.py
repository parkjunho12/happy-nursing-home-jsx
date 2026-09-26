"""근무표 형광펜 — 색·날짜 정리와 '어느 표시가 그 칸에 보이는가' 규칙.

칸 표시와 날 전체(열) 표시가 겹치면 칸 쪽이 이겨야 한다. 좁게 찍은 것이
더 뜻이 있다. 이 규칙이 화면(scheduleHighlight.ts)과 엑셀(export)에서 같아야
벽보와 화면이 다른 곳을 가리키는 일이 없다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_work_schedule_highlight.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import work_schedule_highlight as hl  # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


# ── 색 ──────────────────────────────────────────────────────────────
eq(hl.norm_color("yellow"), "yellow", "노랑 그대로")
eq(hl.norm_color(" PINK "), "pink", "대소문자·공백 정리")
eq(hl.norm_color("purple"), "yellow", "모르는 색은 노랑")
eq(hl.norm_color(""), "", "빈 색 = 지우기")
eq(hl.norm_color(None), "", "None 도 지우기")

# ── 날짜 ────────────────────────────────────────────────────────────
eq(hl.norm_day(1), 1, "1일")
eq(hl.norm_day("31"), 31, "문자열 31")
eq(hl.norm_day(0), None, "0일 없음")
eq(hl.norm_day(32), None, "32일 없음")
eq(hl.norm_day("x"), None, "글자")

# ── 이유 ────────────────────────────────────────────────────────────
eq(hl.norm_note("  근무 변경  "), "근무 변경", "앞뒤 공백")
eq(len(hl.norm_note("가" * 500)), hl.NOTE_MAX, "너무 긴 이유는 자른다")

# ── 키 ──────────────────────────────────────────────────────────────
eq(hl.key_of("s1", 2), "s1:2", "칸 키")
eq(hl.key_of("", 2), ":2", "열 키")
eq(hl.key_of(None, 2), ":2", "None 도 열 키")

# ── 겹침: 칸이 열을 이긴다 ────────────────────────────────────────────
items = [
    {"staff_id": "", "day": 2, "color": "yellow", "note": "근무 변경"},
    {"staff_id": "s1", "day": 2, "color": "pink", "note": "대휴"},
    {"staff_id": "s2", "day": 5, "color": "green", "note": ""},
]
eq(hl.effective(items, "s1", 2)["color"], "pink", "칸 표시가 있으면 그것")
eq(hl.effective(items, "s9", 2)["color"], "yellow", "칸 표시 없으면 열 표시")
eq(hl.effective(items, "s2", 5)["color"], "green", "열 표시 없는 날의 칸")
eq(hl.effective(items, "s1", 5), None, "아무 표시 없음")
eq(hl.effective(items, "s2", 2)["staff_id"], "", "다른 사람 칸 표시는 안 보인다")

# ── 범례: 이유 있는 것만, 날짜 순, 같은 날은 전체 먼저 ──────────────────
names = {"s1": "김철수", "s2": "이영희"}
eq(hl.legend_lines(items, names), ["2일 · 전체 · 근무 변경", "2일 · 김철수 · 대휴"], "범례 순서·내용")
eq(hl.legend_lines([{"staff_id": "zz", "day": 9, "color": "yellow", "note": "x"}], names),
   ["9일 · (퇴사) · x"], "이름 모르는 사람")
eq(hl.legend_lines([], names), [], "빈 범례")

if fails:
    print("❌ 근무표 형광펜 규칙 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 근무표 형광펜 규칙 정상 — 색 5 · 날짜 5 · 이유 2 · 키 3 · 겹침 5 · 범례 3")
