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
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.escort_text import (  # noqa: E402
    request_text, vendor_text, decision_text, missing_fields, guardian_line, UNSET,
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
    "guardian_name": "홍말자", "guardian_relation": "딸", "guardian_phone": "010-1234-5678",
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

# ── ②-2 보호자 연락처는 업체에 보내는 글에만 ──────────────────────────────
# 업체는 보호자와 이동수단을 협의해야 하니 번호가 필요하다. 내부 톡방에까지
# 번호를 뿌릴 이유는 없다 — 나가는 곳을 좁게 둔다.
eq("010-1234-5678" in t, False, "톡방 글에는 보호자 전화번호가 없다")
eq("홍말자" in t, False, "톡방 글에는 보호자 성함도 없다")

v = vendor_text(FULL, writer="박복지", stamp="9/18 11:05")
has(v, "[병원동행 의뢰]", "업체 글 머리")
has(v, "· 보호자: 홍말자(딸) 010-1234-5678", "보호자 성함·관계·전화번호")
has(v, "· 보행: 부축 필요", "업체 글에도 상태가 다 있다")
has(v, "· 편마비: 있음", "편마비")
has(v, "· 휠체어: 사용", "휠체어")
has(v, "· 이동 시 주의사항: 오른쪽 편마비로 왼쪽에서 부축", "주의사항")
has(v, "보호자님과 협의해 정해 주시기 바랍니다", "이동수단은 업체·보호자가 정한다")
has(v, "— 행복한요양원 박복지 · 9/18 11:05", "어디서 보냈는지")

# 관계가 없거나 번호만 있어도 읽히게
eq(guardian_line({"guardian_name": "홍말자", "guardian_phone": "010-1234-5678"}),
   "홍말자 010-1234-5678", "관계 없는 보호자")
eq(guardian_line({"guardian_phone": "010-1234-5678"}), "010-1234-5678", "번호만 있을 때")
eq(guardian_line({}), UNSET, "보호자가 없을 때")

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
   ["보행 가능 여부", "편마비 여부", "휠체어 사용 여부", "보호자 연락처"], "상태를 안 적은 건")
eq(missing_fields({"walking": "가능", "hemiplegia": "없음", "wheelchair": "미사용"}),
   ["병원명", "진료 날짜", "보호자 연락처"], "진료를 안 적은 건")
# 보호자 연락처가 없으면 업체가 협의할 상대가 없다 — 시설이 대신 정하게 된다
eq(missing_fields({**FULL, "guardian_phone": ""}), ["보호자 연락처"], "보호자만 빠진 건")
# 특이사항은 없을 수 있다 — 막지 않는다
eq("특이사항" in " ".join(missing_fields({**FULL, "notes": ""})), False, "특이사항은 필수가 아니다")

# ── ⑤ 누가 올릴 수 있는가 ─────────────────────────────────────────────────
# 올릴 수 있는 사람을 좁히면 '간호선생님 오실 때까지' 기다렸다가 말로 전하게
# 된다. 상태를 직접 보는 자리는 간호팀만이 아니다 — 사회복지사는 보호자·병원
# 연락을 받고, 치료사는 치료 중에 다친 것을 먼저 안다.
#
# 반대로 업체 연락과 이동수단 기록은 복지팀에 둔다. 여러 곳에서 업체에
# 전화하면 업체가 어느 말을 따라야 하는지 모른다.
_SRC = (Path(__file__).resolve().parent.parent
        / "app" / "api" / "v1" / "endpoints" / "hospital_escorts.py").read_text(encoding="utf-8")
_ns = {"Optional": None}
exec(compile(_SRC[_SRC.index("MANAGE = "):_SRC.index("def _viewer")].replace("Optional[str]", "str"),
             "perm", "exec"), _ns, _ns)

for pos, view, req, vendor in [
    ("시설장", True, True, True), ("대표", True, True, True), ("이사", True, True, True),
    ("사회복지사", True, True, True),
    ("간호팀장", True, True, False), ("간호사", True, True, False), ("간호조무사", True, True, False),
    ("물리치료사", True, True, False), ("작업치료사", True, True, False),
    ("요양보호사", False, False, False), ("요양팀장", False, False, False),
    ("영양사", False, False, False), ("조리원", False, False, False),
    ("앨범담당", False, False, False), ("", False, False, False), (None, False, False, False),
]:
    eq(_ns["can_view"]("STAFF", pos), view, f"열람 — {pos!r}")
    eq(_ns["can_write_nursing"]("STAFF", pos), req, f"요청 — {pos!r}")
    eq(_ns["can_write_welfare"]("STAFF", pos), vendor, f"업체 전달 — {pos!r}")
# 관리자는 직종과 무관하게 다 된다
for fn in ("can_view", "can_write_nursing", "can_write_welfare"):
    eq(_ns[fn]("ADMIN", "요양보호사"), True, f"관리자 — {fn}")

if fails:
    print("❌ 병원동행 글 이상")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("✅ 병원동행 글 정상 — 여섯 항목 차례 12건 · 빈 칸 표기 7건 "
      "· 요일 2건 · 업체 글 13건 · 확정 글 7건 · 필수 칸 5건 · 권한 51건")
