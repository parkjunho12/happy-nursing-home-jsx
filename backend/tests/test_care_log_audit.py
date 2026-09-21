"""주간 급여제공 기록지 점검 — validate_findings · build_summary 계산 검사.

  · 필수키(id,date,resident,area,item,kind,issue) 가 빠지면 잡아낸다
  · kind 는 error/blank/check 만 허용한다
  · blank_owner 는 owner_candidates 에 이름을 올린 모든 선생님에게 붙는다
  · by_staff 는 오류+공란 내림차순, 같으면 이름순
  · staff 없이 넘어온 항목은 by_staff 에 안 남는다("미지정" 제외)

의존성 없이 돌아야 한다.  python3 backend/tests/test_care_log_audit.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.care_log_audit import (   # noqa: E402
    build_summary, top_staff, validate_findings,
)

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def ok(cond, name):
    if not cond:
        fails.append(f"{name}: 실패")


def f(**kw):
    row = {
        "id": "x", "date": "2026-09-14", "resident": "강영덕", "room": "305호",
        "area": "신체활동", "item": "이동도움", "kind": "error", "issue": "1회/기준3회",
        "staff": None, "owner_candidates": [],
    }
    row.update(kw)
    return row


# ── ① validate_findings ────────────────────────────────────────────────
eq(validate_findings(None), [], "None 은 통과")
eq(validate_findings([]), [], "빈 배열은 통과")
eq(validate_findings([f()]), [], "필수키 다 있으면 통과")

bad = validate_findings([{"date": "2026-09-14"}])
ok(any("id" in e for e in bad), "id 누락 잡아냄")
ok(any("resident" in e for e in bad), "resident 누락 잡아냄")
ok(any("kind" in e for e in bad), "kind 누락 잡아냄")

bad_kind = validate_findings([f(kind="wrong")])
ok(any("kind" in e for e in bad_kind), "kind 값이 이상하면 잡아냄")

# ── ② build_summary — 빈 입력 ──────────────────────────────────────────
empty = build_summary([])
eq(empty["total"], 0, "빈 findings — total 0")
eq(empty["by_kind"], {"error": 0, "blank": 0, "check": 0}, "빈 findings — by_kind 0")
eq(empty["by_staff"], [], "빈 findings — by_staff 빈 리스트")
eq(empty["by_area"], {}, "빈 findings — by_area 빈 딕셔너리")
eq(empty["by_date"], {}, "빈 findings — by_date 빈 딕셔너리")

# ── ③ build_summary — kind 별 집계 ─────────────────────────────────────
findings = [
    f(id="1", kind="error", staff="김만자", area="신체활동", date="2026-09-14", resident="강영덕", room="305호"),
    f(id="2", kind="error", staff="김만자", area="화장실이용", date="2026-09-15", resident="강영덕", room="305호"),
    f(id="3", kind="blank", staff=None, owner_candidates=["박영선", "최숙진"],
      area="작성자", date="2026-09-15", resident="최길순", room="202호"),
    f(id="4", kind="check", staff="박영선", area="체위변경", date="2026-09-16", resident="최길순", room="202호"),
]
s = build_summary(findings)
eq(s["total"], 4, "total = findings 개수")
eq(s["by_kind"], {"error": 2, "blank": 1, "check": 1}, "kind 별 개수")
eq(s["by_area"]["신체활동"], 1, "by_area — 신체활동")
eq(s["by_area"]["화장실이용"], 1, "by_area — 화장실이용")
eq(s["by_date"], {"2026-09-14": 1, "2026-09-15": 2, "2026-09-16": 1}, "by_date 집계")

by_resident = {r["resident"]: r for r in s["by_resident"]}
eq(by_resident["강영덕"]["total"], 2, "by_resident — 강영덕 2건")
eq(by_resident["강영덕"]["room"], "305호", "by_resident — 호실 포함")
eq(by_resident["최길순"]["total"], 2, "by_resident — 최길순 2건")

# ── ③-2 shared — 작성자 없는 오류(하루 합계 기준)는 후보 전원에게 공동으로 붙는다 ──
shared_rows = build_summary([
    f(id="s1", kind="error", staff=None, owner_candidates=["김만자", "최진흥"], issue="교체(R) 4회 (기준 6회 이상)"),
    f(id="s2", kind="error", staff="김만자", issue="1회 / 기준 3회"),
])["by_staff"]
shared_map = {r["staff"]: r for r in shared_rows}
eq(shared_map["김만자"]["shared"], 1, "김만자 공동 1건")
eq(shared_map["김만자"]["error"], 1, "김만자 오류 1건은 그대로")
eq(shared_map["김만자"]["total"], 2, "김만자 total = 오류+공동")
eq(shared_map["최진흥"]["shared"], 1, "최진흥 공동 1건")
eq(shared_map["최진흥"]["error"], 0, "최진흥 개인 오류는 0")
eq(shared_rows[0]["staff"], "김만자", "오류+공동 많은 순으로 정렬")

# ── ④ blank_owner — 후보 전원에게 붙는다 ────────────────────────────────
by_staff = {r["staff"]: r for r in s["by_staff"]}
eq(by_staff["김만자"]["error"], 2, "김만자 오류 2건")
eq(by_staff["박영선"]["blank_owner"], 1, "박영선 blank_owner 1건(후보)")
eq(by_staff["박영선"]["check"], 1, "박영선 check 1건")
eq(by_staff["박영선"]["total"], 2, "박영선 total = blank_owner+check")
eq(by_staff["최숙진"]["blank_owner"], 1, "최숙진도 같은 공란의 후보라 blank_owner 1건")
eq(by_staff["최숙진"]["error"], 0, "최숙진은 오류 없음")

# staff 없이 온 항목(kind=blank, owner_candidates=[]) 은 아무에게도 안 붙는다
no_owner = build_summary([f(id="5", kind="blank", staff=None, owner_candidates=[])])
eq(no_owner["by_staff"], [], "책임 후보 없는 공란은 by_staff 에 안 남는다(미지정 제외)")

# ── ⑤ by_staff 정렬 — 오류+공란 내림차순, 같으면 이름순 ─────────────────
sort_findings = [
    f(id="a", kind="error", staff="다"),
    f(id="b", kind="error", staff="가"),
    f(id="c", kind="error", staff="가"),
    f(id="d", kind="error", staff="나"),
]
ss = build_summary(sort_findings)
order = [r["staff"] for r in ss["by_staff"]]
eq(order, ["가", "나", "다"], "오류 많은 순 → 같으면 이름순")

# ── ⑥ top_staff ────────────────────────────────────────────────────────
top = top_staff(s, 3)
ok(len(top) <= 3, "top_staff — 최대 3명")
eq(top[0]["staff"], "김만자", "top_staff 1위 = 오류 최다")
eq(set(top[0].keys()), {"staff", "error", "blank_owner", "shared", "total"}, "top_staff 필드 형태")
eq(top_staff(None), [], "summary 없으면 빈 리스트")
eq(top_staff({}), [], "by_staff 없으면 빈 리스트")

if fails:
    print("❌ 주간 기록지 점검 계산 이상")
    for x in fails:
        print("  -", x)
    sys.exit(1)
print("✅ 주간 기록지 점검 계산 정상 — 검증 6건 · 집계 12건 · 정렬 1건 · top_staff 5건")
