"""퇴소 시각 — 식이 현황에서 언제 빠지는가.

황영수 어르신을 9/24 08:00 퇴소로 처리했는데 그날 식이 현황에 그대로
남아 있었다. 날짜만 보고 시각을 안 봤기 때문이다. 이 규칙이 다시 무너지면
주방은 퇴소한 분의 상을 차리고, 반대로 서두르면 퇴소일 아침 한 끼가 빈다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_diet_discharge.py
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import diet_discharge as dd  # noqa: E402

KST = timezone(timedelta(hours=9))
fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def at(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=KST)


def st(r, on, now=None):
    d = dd.discharge_state(r, on, now)
    return (d["show"], d["label"])


R = NS(discharge_date="2026-09-24", discharge_time="08:00")

# ── 퇴소 당일, 오늘 ───────────────────────────────────────────────────────
eq(st(R, "2026-09-24", at("2026-09-24 07:30")), (True, "오늘 08:00 퇴소"), "시각 전 — 아직 계신다")
eq(st(R, "2026-09-24", at("2026-09-24 08:00")), (False, None), "정각 — 빠진다")
eq(st(R, "2026-09-24", at("2026-09-24 12:27")), (False, None), "시각 지남 — 빠진다 (황영수 사례)")

# ── 날짜 경계 ─────────────────────────────────────────────────────────────
eq(st(R, "2026-09-23", at("2026-09-24 12:00")), (True, None), "퇴소 전날 — 표시 없이 재원")
eq(st(R, "2026-09-25", at("2026-09-25 09:00")), (False, None), "퇴소 다음날 — 빠진다")
eq(st(R, "2026-09-24", at("2026-09-30 09:00")), (True, "08:00 퇴소"), "지난 날짜 되감기 — 남기고 표시")
eq(st(R, "2026-09-24", at("2026-09-20 09:00")), (True, "08:00 퇴소 예정"), "앞날 미리 보기 — 예정 표시")

# ── 시각을 안 적은 퇴소 ───────────────────────────────────────────────────
N = NS(discharge_date="2026-09-24", discharge_time=None)
eq(st(N, "2026-09-24", at("2026-09-24 23:00")), (True, "오늘 퇴소"), "시각 없음 — 하루 끝까지 남는다")
eq(st(N, "2026-09-25", at("2026-09-25 01:00")), (False, None), "시각 없음 — 다음날엔 빠진다")

# ── 퇴소 기록이 없는 분 · 예정만 잡힌 분 ───────────────────────────────────
eq(st(NS(discharge_date=None, discharge_time=None), "2026-09-24", at("2026-09-24 12:00")),
   (True, None), "퇴소 기록 없음 — 그대로")
eq(st(NS(discharge_date="", discharge_time="08:00"), "2026-09-24", at("2026-09-24 12:00")),
   (True, None), "날짜 없이 시각만 — 무시")
eq(st(NS(discharge_date="2026-10-01", discharge_time="10:00"), "2026-09-24", at("2026-09-24 12:00")),
   (True, None), "퇴소일이 앞에 있음 — 아직 계신다")

# ── 시각 표기 흔들림 ──────────────────────────────────────────────────────
eq(st(NS(discharge_date="2026-09-24", discharge_time="8:00"), "2026-09-24", at("2026-09-24 08:01")),
   (False, None), "'8:00' 도 08:00 으로 읽는다")
eq(st(NS(discharge_date="2026-09-24", discharge_time="08:00:00"), "2026-09-24", at("2026-09-24 07:59")),
   (True, "오늘 08:00 퇴소"), "'08:00:00' 도 읽는다")
eq(st(NS(discharge_date="2026-09-24", discharge_time="오전"), "2026-09-24", at("2026-09-24 23:00")),
   (True, "오늘 퇴소"), "못 읽는 시각 — 시각 없는 것과 같이 하루 끝까지")
eq(st(NS(discharge_date="2026-09-24T00:00:00", discharge_time="08:00"), "2026-09-24", at("2026-09-24 09:00")),
   (False, None), "날짜에 시간이 붙어 있어도 앞 10자리로 본다")

# ── now 가 UTC 로 와도 KST 로 판정해야 한다 ──────────────────────────────
utc_now = datetime(2026, 9, 24, 3, 30, tzinfo=timezone.utc)  # KST 12:30
eq(st(R, "2026-09-24", utc_now.astimezone(KST)), (False, None), "UTC now → KST 변환 후 판정")

# ── now 없이 부르면 시각 판정을 못 하니 안전하게 남긴다 ─────────────────
eq(st(R, "2026-09-24", None), (True, "08:00 퇴소 예정"), "now 없음 — 빼지 않는다")

if fails:
    print("❌ 퇴소 시각 판정 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 퇴소 시각 판정 정상 — 당일 3건 · 경계 4건 · 시각 없음 2건 · 기록 없음 3건 · 표기 4건 · 시간대 2건")
