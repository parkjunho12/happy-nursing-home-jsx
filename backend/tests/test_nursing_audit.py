"""간호기록 점검 — validate_findings · build_summary · slice_by_date 계산 검사.

  · 필수키가 빠지면 잡아낸다, kind 는 error/check/info 만
  · by_resident 는 오류 내림차순, by_staff 는 staff 가 있는 항목만
  · slice_by_date 는 구간 포함(양끝) 으로 자른다
  · home_nursing 집계는 type 별 '가정간호' 표시 건수만 센다

의존성 없이 돌아야 한다.  python3 backend/tests/test_nursing_audit.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.nursing_audit import build_summary, slice_by_date, validate_findings  # noqa: E402

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def f(**kw):
    row = {"id": "x", "date": "2026-09-20", "resident": "김승호", "resident_id": "1", "room": "204호",
           "area": "투약", "item": "미작성", "kind": "error", "issue": "아침식후 제공자 없음", "staff": None}
    row.update(kw)
    return row


# validate
eq(validate_findings(None), [], "None 허용")
eq(validate_findings([f()]), [], "정상 1건")
errs = validate_findings([f(kind="blank"), f(id="y", issue=""), f(id="z", date="2026/09/20")])
assert any("kind=" in e for e in errs), errs
assert any("issue 누락" in e for e in errs), errs
assert any("date 형식" in e for e in errs), errs
assert any("id 중복" in e for e in validate_findings([f(), f()]))

# summary
rows = [f(id="1"), f(id="2", kind="check", resident="박청", resident_id="2", room="304호", staff="박미순"),
        f(id="3", kind="error", resident="박청", resident_id="2", room="304호", staff="박미순", area="간호일지", item="건강관리 미체크"),
        f(id="4", kind="info", resident="3명", resident_id=None, date="2026-09-21")]
s = build_summary(rows, [{"type": "욕창간호", "home_nursing": True}, {"type": "욕창간호", "home_nursing": False}, {"type": "도뇨관", "home_nursing": True}])
eq(s["total"], 4, "total")
eq(s["by_kind"], {"error": 2, "check": 1, "info": 1}, "by_kind")
eq(s["by_area"], {"투약": 3, "간호일지": 1}, "by_area")
eq(s["by_item"]["투약 · 미작성"], 3, "by_item")
eq([r["resident"] for r in s["by_resident"]], ["박청", "김승호"], "by_resident 순서(오류 같으면 확인 많은 쪽)")
eq(s["by_staff"], [{"staff": "박미순", "error": 1, "check": 1, "info": 0, "total": 2}], "by_staff")
eq(s["by_date"]["2026-09-21"], {"error": 0, "check": 0, "info": 1}, "by_date")
eq(s["home_nursing"], {"욕창간호": 1, "비위관": 0, "도뇨관": 1}, "home_nursing")

# slice
eq([r["id"] for r in slice_by_date(rows, "2026-09-21", "2026-09-21")], ["4"], "slice 양끝 포함")
eq(slice_by_date(rows, "2026-10-01", "2026-10-07"), [], "slice 빈 구간")

if fails:
    print("\n".join("not ok - " + x for x in fails))
    sys.exit(1)
print("ok - test_nursing_audit (%d checks)" % 14)
