"""재직 중인 직원을 완전히 지울 수 있는 사람.

직원을 지우면 근무표·체크리스트·인사기록이 함께 지워지고 되돌릴 수 없다.
그래서 아무나 못 하게 막아 두었는데, 판정을 role 로만 하면 시설장이 영영
못 지운다 — 시설장의 role 은 STAFF 다. 직종도 함께 봐야 한다.

반대로 이 판정이 헐거워지면 요양보호사도 동료를 지울 수 있게 된다.
그건 사고다. 그래서 양쪽을 다 못박아 둔다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_staff_delete_perm.py
"""
from __future__ import annotations

import sys
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent
       / "app" / "api" / "v1" / "endpoints" / "eval_people.py").read_text(encoding="utf-8")


def _fn():
    ns: dict = {}
    exec(SRC[SRC.index("STAFF_DELETE_POSITIONS"):SRC.index('@staff_router.delete("/{sid}"')], ns)
    return ns["can_delete_active_staff"]


def check() -> int:
    can = _fn()
    bad: list[str] = []

    def case(role, pos, want, why):
        got = can(role, pos)
        if got is not want:
            bad.append(f"{why} (role={role!r}, 직종={pos!r}): {want} 여야 하는데 {got}")

    # 지울 수 있어야 하는 사람
    case("ADMIN", None, True, "관리자")
    case("ADMIN", "요양보호사", True, "관리자(직종 무관)")
    case("STAFF", "시설장", True, "시설장")

    # 지우면 안 되는 사람 — 퇴사 처리를 써야 한다
    for pos in ("요양보호사", "간호팀장", "사회복지사", "물리치료사", "작업치료사",
                "영양사", "요양팀장", "간호사", "앨범담당", "외부담당", None, ""):
        case("STAFF", pos, False, f"'{pos}' 는 지울 수 없어야 한다")

    # 대표·이사는 넣지 않았다. 넣을지는 사람이 정할 일이라 임의로 늘리지 않는다.
    case("STAFF", "대표", False, "대표(지금 규칙상 제외)")
    case("STAFF", "이사", False, "이사(지금 규칙상 제외)")

    # 직종 이름이 비슷한 것에 걸리지 않아야 한다
    case("STAFF", "부시설장", False, "부시설장")
    case("STAFF", "시설장대행", False, "시설장대행")
    case("STAFF", " 시설장", False, "앞에 공백이 붙은 값")

    if bad:
        print("❌ 직원 삭제 권한이 어긋납니다 — 되돌릴 수 없는 삭제입니다.")
        for b in bad:
            print("   ·", b)
        return 1

    print("✅ 직원 삭제 권한 정상 — 허용 3건 · 거부 16건")
    return 0


def test_staff_delete_perm():
    assert check() == 0


if __name__ == "__main__":
    sys.exit(check())
