"""응급벨 명단 — 누가 고칠 수 있고, 무엇을 막아야 하는가.

벨이 울리면 번호만 뜬다. 그 번호가 몇 호실 누구인지 보고 달려간다.
명단이 틀리면 엉뚱한 방으로 간다. 응급 상황에서 그 몇 초가 전부다.

지키는 것
  1. 요양보호사는 보기만 한다. 벨을 받고 달려가는 분들이라 명단은 꼭 봐야
     하지만, 어느 방에 누가 계신지 정하는 것은 그분들 일이 아니다.
  2. 화장실 벨에는 이름을 넣지 않는다. 넣으면 배치도가 거짓말이 된다.
  3. 이름 없이 '재실' 로 둘 수 없다. 배치도에 빈칸이 재실로 찍힌다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_emergency_bell.py
"""
from __future__ import annotations

import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
API = (BASE / "app" / "api" / "v1" / "endpoints" / "emergency_bell.py").read_text(encoding="utf-8")
MODEL = (BASE / "app" / "models" / "emergency_bell.py").read_text(encoding="utf-8")


def _env():
    ns: dict = {}
    exec(MODEL[MODEL.index("KIND_ROOM ="):MODEL.index("class EmergencyBell")], ns)
    exec(API[API.index("EDIT_POSITIONS ="):API.index("def _role")], ns)
    exec(API[API.index("def can_edit"):API.index("def _editor")], ns)
    return ns


def check() -> int:
    ns = _env()
    can = ns["can_edit"]
    bad: list[str] = []

    # ── 누가 고칠 수 있나 ────────────────────────────────────────
    for role, pos, want, why in [
        ("ADMIN", None, True, "관리자"),
        ("ADMIN", "요양보호사", True, "관리자(직종 무관)"),
        ("STAFF", "시설장", True, "시설장"),
        ("STAFF", "간호팀장", True, "간호팀장"),
        ("STAFF", "간호사", True, "간호사"),
        ("STAFF", "사회복지사", True, "사회복지사"),
        ("STAFF", "요양팀장", True, "요양팀장"),
        # 보기만 하는 사람들
        ("STAFF", "요양보호사", False, "요양보호사는 보기만"),
        ("STAFF", "물리치료사", False, "물리치료사"),
        ("STAFF", "작업치료사", False, "작업치료사"),
        ("STAFF", "영양사", False, "영양사"),
        ("STAFF", "앨범담당", False, "앨범담당"),
        ("STAFF", "외부담당", False, "외부담당"),
        ("STAFF", None, False, "직종 없음"),
        ("STAFF", "", False, "직종 빈값"),
        ("STAFF", " 시설장", False, "앞에 공백이 붙은 값"),
        ("STAFF", "부시설장", False, "이름만 비슷한 직종"),
    ]:
        got = can(role, pos)
        if got is not want:
            bad.append(f"{why} (role={role}, 직종={pos!r}): {want} 여야 하는데 {got}")

    # ── 화장실 구분이 빠짐없이 잡히는가 ──────────────────────────
    # 하나라도 빠지면 그 화장실 칸에 사람 이름이 들어간다
    for k in (ns["KIND_WC_SHARED"], ns["KIND_WC_PRIVATE"], ns["KIND_WC_FLOOR"]):
        if k not in ns["WC_KINDS"]:
            bad.append(f"화장실 구분 '{k}' 가 목록에 없다 — 그 칸에 이름이 들어간다")
    if ns["KIND_ROOM"] in ns["WC_KINDS"]:
        bad.append("생활실이 화장실로 분류된다 — 이름을 못 넣게 된다")

    # ── 상태 값 ─────────────────────────────────────────────────
    if ns["STATUSES"] != ("재실", "공실"):
        bad.append(f"상태 값이 바뀌었다: {ns['STATUSES']} — 화면·배치도와 어긋난다")

    # 이름 없이 '재실' 을 막는 규칙이 코드에 남아 있는가
    if "이름 없이" not in API:
        bad.append("이름 없이 '재실' 을 막는 검사가 사라졌다")
    if "화장실 벨에는 이름을" not in API:
        bad.append("화장실 칸에 이름을 막는 검사가 사라졌다")

    if bad:
        print("❌ 응급벨 명단 규칙이 어긋납니다 — 응급 상황에 엉뚱한 방으로 갑니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print("✅ 응급벨 명단 정상 — 권한 17건 · 화장실 구분 4건 · 상태·검사 4건")
    return 0


def test_emergency_bell():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
