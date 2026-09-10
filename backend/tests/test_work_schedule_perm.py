"""근무표 — 누가 볼 수 있고, 누가 고칠 수 있는가.

판정을 role 로만 하면 시설장이 자기 근무표를 못 만진다(시설장의 role 은 STAFF).
반대로 헐거워지면 요양보호사가 동료 전체의 근무를 들여다보게 된다.
그래서 양쪽을 다 못박아 둔다.

특히 '보기' 와 '편성' 이 한 덩어리가 되면 안 된다. 사회복지사에게 일정 잡으라고
근무표를 열어 준 것이지, 근무를 바꾸라고 연 것이 아니다. 근무표는 급여·연차로
이어진다.

의존성 없이 돌아야 한다.  python3 backend/tests/test_work_schedule_perm.py
"""
from __future__ import annotations

import sys
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent
       / "app" / "api" / "v1" / "endpoints" / "work_schedule.py").read_text(encoding="utf-8")


def _fns():
    """판정 함수 두 개만 떼어 온다 — FastAPI·DB 없이."""
    ns: dict = {"Optional": None}
    body = SRC[SRC.index("EDIT_POSITIONS ="):SRC.index("def _manager(")]
    body = body.replace("Optional[str]", "str")          # typing 없이 돌게
    exec(body, ns)
    return ns["can_view_schedule"], ns["can_edit_schedule"]


ALL_POSITIONS = [
    "시설장", "대표", "이사", "사회복지사", "요양보호사", "요양팀장",
    "간호팀장", "간호사", "간호조무사", "물리치료사", "작업치료사",
    "영양사", "조리원", "앨범담당", "외부담당", "사무원", None, "",
]

# 전체 근무표를 볼 수 있는 사람. 여기 없는 직종은 제 근무표(/my-schedule)만 본다.
CAN_VIEW = {"시설장", "대표", "이사", "사회복지사"}
# 편성·메모·잠금 — 급여와 연차로 이어지므로 좁게 둔다
CAN_EDIT = {"시설장"}


def check() -> int:
    view, edit = _fns()
    bad: list[str] = []

    def case(fn, role, pos, want, what):
        got = fn(role, pos)
        if got is not want:
            bad.append(f"{what} — role={role!r} 직종={pos!r}: {want} 여야 하는데 {got}")

    # 관리자는 직종과 무관하게 다 된다
    for pos in (None, "요양보호사", "사회복지사"):
        case(view, "ADMIN", pos, True, "관리자 보기")
        case(edit, "ADMIN", pos, True, "관리자 편성")

    # 직종별 — 전 직종을 훑는다. 새 직종이 생겨도 조용히 열리지 않게.
    for pos in ALL_POSITIONS:
        case(view, "STAFF", pos, pos in CAN_VIEW, "보기")
        case(edit, "STAFF", pos, pos in CAN_EDIT, "편성")

    # 보기와 편성이 한 덩어리가 되면 안 된다 — 볼 수 있지만 못 고치는 사람이 있어야
    only_view = [p for p in ALL_POSITIONS
                 if view("STAFF", p) and not edit("STAFF", p)]
    if sorted(x for x in only_view if x) != ["대표", "사회복지사", "이사"]:
        bad.append(f"보기만 되는 직종이 어긋납니다: {only_view}")

    # 고칠 수 있으면 볼 수도 있어야 한다 — 그 반대는 아니다
    for pos in ALL_POSITIONS:
        if edit("STAFF", pos) and not view("STAFF", pos):
            bad.append(f"'{pos}' 는 고칠 수 있는데 볼 수 없습니다")

    if bad:
        print("❌ 근무표 권한 이상")
        for b in bad:
            print("  -", b)
        return 1
    print(f"✅ 근무표 권한 정상 — 직종 {len(ALL_POSITIONS)}개 × 보기·편성 "
          f"{len(ALL_POSITIONS) * 2}건 · 관리자 6건 · 보기/편성 분리 확인")
    return 0


if __name__ == "__main__":
    sys.exit(check())
