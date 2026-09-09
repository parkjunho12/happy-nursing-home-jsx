"""블로그 주 2회 예약 — 언제 도는가, 그리고 무엇이 있어야 나가는가.

여기서 지키려는 것 두 가지.

  ① 정해진 요일·시각에만 돈다. 매 tick 마다 글을 만들면 돈이 샌다.
  ② 사람이 공개 사용을 확인한 사진만 나간다. 얼굴을 가렸다는 것과
     블로그에 올려도 된다는 것은 다른 이야기다.

②는 값이 하나만 바뀌어도 조용히 뚫린다. 그래서 실제 판정 함수를 부른다.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 둘 다 표준 라이브러리만 쓴다 — 배포 전 검사는 설치 없이 돈다
from app.services.blog_gate import (  # noqa: E402
    MASK_MASKED, MASK_NO_FACE, USE_ALLOWED, USE_DENIED, USE_UNKNOWN, photo_usable,
)
from app.services import blog_schedule as sc  # noqa: E402

KST = timezone(timedelta(hours=9))
fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


# ── ① 언제 도는가 ─────────────────────────────────────────────────────────
# 2026-09-07(월) 부터 한 주. 화·금 10시~18시 사이에만 True.
WEEK = [
    ("월", 7), ("화", 8), ("수", 9), ("목", 10), ("금", 11), ("토", 12), ("일", 13),
]
n_due = 0
for label, day in WEEK:
    for hour in range(0, 24):
        want = label in ("화", "금") and 10 <= hour < 18
        got = sc.due(datetime(2026, 9, day, hour, 0, tzinfo=KST))
        eq(got, want, f"{label}요일 {hour}시")
        n_due += 1

# 경계 — 9시 59분은 아직, 10시 정각부터
eq(sc.due(datetime(2026, 9, 8, 9, 59, tzinfo=KST)), False, "화 9:59")
eq(sc.due(datetime(2026, 9, 8, 10, 0, tzinfo=KST)), True, "화 10:00")
eq(sc.due(datetime(2026, 9, 8, 17, 59, tzinfo=KST)), True, "화 17:59")
eq(sc.due(datetime(2026, 9, 8, 18, 0, tzinfo=KST)), False, "화 18:00 — 퇴근 뒤")

# 회차 이름은 날짜로 정한다 — 같은 날 두 번 만들지 않게 하는 열쇠다
eq(sc.run_key_for(datetime(2026, 9, 8, tzinfo=KST).date()), "auto-2026-09-08", "회차 이름")

# 주 2회인가 — 한 주에 도는 날이 정확히 둘
days = sum(1 for _, d in WEEK if sc.due(datetime(2026, 9, d, 10, tzinfo=KST)))
eq(days, 2, "한 주에 도는 날")


# ── ② 무엇이 있어야 나가는가 ──────────────────────────────────────────────
def photo(**kw) -> bool:
    return photo_usable(kw.get("publicity", USE_UNKNOWN),
                        kw.get("mask_status", MASK_MASKED),
                        kw.get("reviewed", True),
                        kw.get("sensitive", False))


CASES = [
    ("전부 갖춘 사진", dict(publicity=USE_ALLOWED), True),
    ("동의 확인 안 함", dict(publicity=USE_UNKNOWN), False),
    ("쓰면 안 된다고 표시", dict(publicity=USE_DENIED), False),
    ("가림을 눈으로 확인 안 함", dict(publicity=USE_ALLOWED, reviewed=False), False),
    ("얼굴을 못 찾은 사진", dict(publicity=USE_ALLOWED, mask_status=MASK_NO_FACE), False),
    ("민감하다고 표시", dict(publicity=USE_ALLOWED, sensitive=True), False),
]
for name, kw, want in CASES:
    eq(photo(**kw), want, f"사진 판정 — {name}")

# 얼굴을 못 찾았다는 것은 '가릴 것이 없었다' 가 아니라 '못 찾았다' 일 수 있다.
# 그래서 no_face 는 자동으로 나가지 않는다 — 위 표에서 확인한 그대로다.

if fails:
    print("❌ 블로그 예약 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print(f"✅ 블로그 예약 정상 — 요일·시각 {n_due}건 · 경계 4건 · 사진 판정 {len(CASES)}건")
