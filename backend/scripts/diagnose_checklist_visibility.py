"""
체크리스트 가시성 진단 스크립트

목적:
  "직원(STAFF) 계정인데 체크리스트가 전부 보인다"는 증상의 원인을
  코드가 아니라 '데이터'에서 바로 확인한다.

확인 항목:
  1) 해당 계정의 role 이 실제로 STAFF 인지 ADMIN 인지
  2) 그 계정에 assigned_user_id 로 배정된 체크리스트가 몇 건인지
     (전체 건수 대비. 전부 배정돼 있으면 '과배정'이 원인)

실행 (backend/ 디렉토리에서):
  python -m scripts.diagnose_checklist_visibility someone@example.com
  # 이메일을 생략하면 전체 사용자 요약을 출력한다.

원인별 조치:
  - role 이 ADMIN 으로 나오면  -> '직원 계정 관리'에서 권한을 '직원'으로 변경
  - role 은 STAFF 인데 assigned_count 가 전체와 같으면 -> 과배정.
    아래 unassign 옵션으로 정리 가능:
      python -m scripts.diagnose_checklist_visibility someone@example.com --unassign-all
    (해당 계정에 배정된 모든 체크리스트의 담당자 지정을 해제한다)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.eval import ChecklistItem


def _role(u: User) -> str:
    return u.role.value if hasattr(u.role, "value") else str(u.role)


def summarize_all(db):
    total = db.query(ChecklistItem).count()
    users = db.query(User).order_by(User.name).all()
    print(f"\n전체 체크리스트 항목 수: {total}\n")
    print(f"{'이름':<12}{'권한':<8}{'직종':<12}{'배정건수':>8}   이메일")
    print("-" * 70)
    for u in users:
        assigned = db.query(ChecklistItem).filter(
            ChecklistItem.assigned_user_id == u.id
        ).count()
        print(f"{u.name:<12}{_role(u):<8}{(u.position or '-'):<12}{assigned:>8}   {u.email}")
    print()


def diagnose(db, email: str, unassign_all: bool = False):
    total = db.query(ChecklistItem).count()
    u = db.query(User).filter(User.email == email).first()
    if not u:
        print(f"[!] '{email}' 계정을 찾을 수 없습니다.")
        return

    assigned = db.query(ChecklistItem).filter(
        ChecklistItem.assigned_user_id == u.id
    ).count()

    print("\n=== 진단 결과 ===")
    print(f"이름      : {u.name}")
    print(f"이메일    : {u.email}")
    print(f"권한(role): {_role(u)}")
    print(f"직종      : {u.position or '-'}")
    print(f"배정 건수 : {assigned} / 전체 {total}")
    print("-" * 40)

    if _role(u) == "ADMIN":
        print("원인: 이 계정의 '권한'이 ADMIN 입니다. ADMIN은 설계상 전체 조회됩니다.")
        print("조치: '직원 계정 관리'에서 권한을 '직원'으로 변경하세요.")
    elif total > 0 and assigned >= total:
        print("원인: STAFF 인데 사실상 모든 항목이 이 계정에 배정(assigned_user_id)되어 있습니다. (과배정)")
        print("조치: --unassign-all 옵션으로 배정을 정리하거나, 화면에서 담당자를 재지정하세요.")
    else:
        print("이 계정은 정상 범위입니다. (STAFF, 배정된 항목만 조회)")
        print("목록 페이지에서 전부 보인다면 서버가 최신 코드로 배포됐는지 확인하세요.")

    if unassign_all and _role(u) != "ADMIN":
        n = db.query(ChecklistItem).filter(
            ChecklistItem.assigned_user_id == u.id
        ).update({ChecklistItem.assigned_user_id: None}, synchronize_session=False)
        db.commit()
        print(f"\n[정리 완료] {n}건의 담당자 지정을 해제했습니다.")
    print()


def main():
    args = [a for a in sys.argv[1:]]
    unassign_all = "--unassign-all" in args
    args = [a for a in args if not a.startswith("--")]

    db = SessionLocal()
    try:
        if not args:
            summarize_all(db)
        else:
            diagnose(db, args[0], unassign_all=unassign_all)
    finally:
        db.close()


if __name__ == "__main__":
    main()
