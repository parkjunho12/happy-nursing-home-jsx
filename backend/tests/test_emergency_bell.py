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
    exec(API[API.index("LAYOUT_POSITIONS ="):API.index("def _layout_editor")], ns)
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

    # ── 벨 번호를 바꿀 수 있는 사람 ──────────────────────────────
    # 설비가 바뀌었을 때만 손대는 일이다. 잘못 바꾸면 벨이 울렸을 때
    # 엉뚱한 방으로 간다. 이름을 고칠 수 있는 사람보다 더 좁게 둔다.
    canL = ns["can_edit_layout"]
    for role, pos, want, why in [
        ("ADMIN", None, True, "관리자"),
        ("STAFF", "시설장", True, "시설장"),
        ("STAFF", "간호팀장", False, "간호팀장은 이름만 고친다"),
        ("STAFF", "사회복지사", False, "사회복지사는 이름만 고친다"),
        ("STAFF", "요양보호사", False, "요양보호사"),
        ("STAFF", None, False, "직종 없음"),
    ]:
        got = canL(role, pos)
        if got is not want:
            bad.append(f"[배치] {why}: {want} 여야 하는데 {got}")

    # 배치 수정 권한이 이름 수정 권한보다 넓어지면 안 된다
    for pos in ("간호팀장", "사회복지사", "요양팀장", "간호사"):
        if canL("STAFF", pos) and not can("STAFF", pos):
            bad.append(f"'{pos}' 가 이름은 못 고치는데 벨 번호는 고칠 수 있다")

    # 맞바꾸기를 위해 두 단계로 쓰는가.
    # 유니크 제약은 UPDATE 한 줄마다 검사된다. 그래서 1번↔2번을 맞바꾸면
    # 1번을 2로 바꾸는 순간 아직 2번인 줄과 겹쳐 거절당한다. 한 트랜잭션에
    # 묶어도 마찬가지다 — 실제로 그렇게 만들었다가 맞바꾸기가 통째로 안 됐다.
    if "b.no = -k" not in API and "no = -k" not in API:
        bad.append("번호를 잠깐 음수로 옮기는 단계가 사라졌다 — 맞바꾸기가 안 된다")
    if "db.flush()" not in API:
        bad.append("중간 단계를 밀어 넣는 flush 가 사라졌다 — 맞바꾸기가 안 된다")

    # 번호 겹침을 막는 검사가 남아 있는가 — 겹치면 갈 방을 못 찾는다
    if "번호는 겹칠 수 없습니다" not in API:
        bad.append("벨 번호 겹침을 막는 검사가 사라졌다")
    if "한 번에 한 층만" not in API:
        bad.append("여러 층을 섞어 바꾸는 것을 막는 검사가 사라졌다")

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

    print("✅ 응급벨 명단 정상 — 이름 권한 17건 · 배치 권한 10건 · 화장실 4건 · 상태·검사 8건")
    return 0


def test_emergency_bell():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
