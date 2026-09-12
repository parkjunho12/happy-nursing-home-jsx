"""병원동행 — 부서 톡방에 나가는 글.

이 글이 업체로 가는 유일한 근거다. 한 줄이 빠지면 업체는 그걸 묻지 않고
그대로 차를 잡는다. 휠체어를 쓰시는 분께 일반 승용차가 오면 그날 병원
앞에서 일이 멈춘다.

  · 여섯 가지가 정해진 차례로 다 있어야 한다
  · 안 적힌 칸은 빈칸이 아니라 '확인 필요' 로 나가야 한다
    (비워 두면 읽는 사람이 '없음' 으로 읽는다)
  · 업체에 넘기기 전 반드시 채워야 할 칸을 집어낼 수 있어야 한다

의존성 없이 돌아야 한다.  python3 backend/tests/test_escort_text.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.escort_text import (  # noqa: E402
    request_text, decision_text, missing_fields, UNSET,
)

fails = []


def eq(got, want, name):
    if got != want:
        fails.append(f"{name}: {got!r} ≠ {want!r}")


def has(text: str, needle: str, name: str):
    if needle not in text:
        fails.append(f"{name}: 글에 {needle!r} 가 없습니다")


FULL = {
    "resident_name": "홍길동", "floor": "2층", "room": "201",
    "walking": "부축 필요", "hemiplegia": "있음", "wheelchair": "사용",
    "notes": "오른쪽 편마비로 왼쪽에서 부축",
    "hospital": "의정부성모병원", "department": "정형외과",
    "visit_date": "2026-09-25", "visit_time": "10:30",
}

# ── ① 여섯 가지가 정해진 차례로 ───────────────────────────────────────────
t = request_text(FULL, writer="김간호", stamp="9/12 14:30")
lines = t.splitlines()
eq(lines[0], "[병원동행 요청]", "첫 줄")
eq(lines[1], "1. 어르신: 홍길동 (2층 201호)", "1. 성함")
eq(lines[2], "2. 보행: 부축 필요", "2. 보행")
eq(lines[3], "3. 편마비: 있음", "3. 편마비")
eq(lines[4], "4. 휠체어: 사용", "4. 휠체어")
eq(lines[5], "5. 특이사항·이동 시 주의사항: 오른쪽 편마비로 왼쪽에서 부축", "5. 특이사항")
eq(lines[6], "6. 진료: 의정부성모병원 정형외과 · 9월 25일(금) 10:30", "6. 진료")
has(t, "보호자와 동행업체가 협의해 정합니다", "이동수단은 시설이 정하지 않는다는 안내")
has(t, "— 간호팀 김간호 · 9/12 14:30", "누가 언제 적었는지")

# 번호가 뒤섞이면 안 된다 — 톡방에서 눈으로 훑는 글이다
for i, head in enumerate(["1. 어르신", "2. 보행", "3. 편마비", "4. 휠체어",
                          "5. 특이사항", "6. 진료"], start=1):
    eq(lines[i].startswith(head), True, f"{i}번 줄머리")

# ── ② 빈 칸은 '확인 필요' 로 ──────────────────────────────────────────────
bare = request_text({"resident_name": "김분임"})
has(bare, f"2. 보행: {UNSET}", "안 적은 보행")
has(bare, f"3. 편마비: {UNSET}", "안 적은 편마비")
has(bare, f"4. 휠체어: {UNSET}", "안 적은 휠체어")
has(bare, "5. 특이사항·이동 시 주의사항: 없음", "주의사항은 '없음' 이 정상이다")
has(bare, f"6. 진료: {UNSET}", "안 적은 병원")
eq("보행: \n" in bare or "보행: $" in bare, False, "빈칸으로 내보내지 않는다")

# 호실이 없으면 괄호를 붙이지 않는다
eq(request_text({"resident_name": "김분임"}).splitlines()[1], "1. 어르신: 김분임", "호실 없을 때")

# 요일을 붙인다 — 날짜만 적으면 며칠인지 헷갈린다
has(request_text({**FULL, "visit_date": "2026-09-25"}), "9월 25일(금)", "요일")
has(request_text({**FULL, "visit_date": "2026-10-01"}), "10월 1일(목)", "요일2")

# ── ③ 이동수단 확정 글 ────────────────────────────────────────────────────
d = decision_text({**FULL, "transport": "휠체어 리프트 차량", "vendor": "행복동행케어",
                   "transport_note": "보호자(딸)와 업체 통화로 확정"},
                  writer="박복지", stamp="9/18 11:05")
has(d, "[병원동행 이동수단 확정]", "확정 글 머리")
has(d, "이동수단: 휠체어 리프트 차량", "이동수단")
has(d, "동행업체: 행복동행케어", "업체")
has(d, "협의 내용: 보호자(딸)와 업체 통화로 확정", "협의 내용")
has(d, "— 복지팀 박복지 · 9/18 11:05", "누가 언제")
# 업체·협의 내용이 없으면 그 줄은 아예 안 넣는다 (빈 줄이 남으면 지저분하다)
d2 = decision_text({**FULL, "transport": "보호자 차량"})
eq("동행업체:" in d2, False, "업체 없으면 그 줄 없음")
eq("협의 내용:" in d2, False, "협의 내용 없으면 그 줄 없음")

# ── ④ 업체에 넘기기 전 채워야 하는 칸 ─────────────────────────────────────
eq(missing_fields(FULL), [], "다 적힌 건")
eq(missing_fields({"hospital": "A병원", "visit_date": "2026-09-25"}),
   ["보행 가능 여부", "편마비 여부", "휠체어 사용 여부"], "상태를 안 적은 건")
eq(missing_fields({"walking": "가능", "hemiplegia": "없음", "wheelchair": "미사용"}),
   ["병원명", "진료 날짜"], "진료를 안 적은 건")
# 특이사항은 없을 수 있다 — 막지 않는다
eq("특이사항" in " ".join(missing_fields({**FULL, "notes": ""})), False, "특이사항은 필수가 아니다")

if fails:
    print("❌ 병원동행 글 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 병원동행 글 정상 — 여섯 항목 차례 12건 · 빈 칸 표기 7건 "
      "· 요일 2건 · 확정 글 7건 · 필수 칸 4건")
