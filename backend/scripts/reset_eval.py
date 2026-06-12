"""
평가 데이터 초기화 스크립트
실행: python -m scripts.reset_eval
(backend/ 디렉토리에서 실행)

삭제 순서 (FK 의존성 고려):
  1. checklist_occurrences
  2. completion_records
  3. checklist_items
  4. ltc_residents
  5. ltc_staff_members
  6. eval_sub_indicators
  7. eval_categories
  8. eval_domains
  9. eval_settings
  10. eval_guidelines (있으면)
  11. eval_ai_reviews (있으면)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal, engine
from sqlalchemy import text

TABLES = [
    "checklist_occurrences",
    "completion_records",
    "checklist_items",
    "ltc_residents",
    "ltc_staff_members",
    "eval_sub_indicators",
    "eval_categories",
    "eval_domains",
    "eval_settings",
    "eval_guidelines",    # AI 검토 기능
    "eval_ai_reviews",    # AI 검토 기능
]

def reset():
    db = SessionLocal()
    try:
        print("⚠️  평가 데이터 초기화 시작...")
        print("   (수급자·직원·체크리스트·occurrence 전체 삭제)")
        print()

        for table in TABLES:
            try:
                result = db.execute(text(f"DELETE FROM {table}"))
                count  = result.rowcount
                print(f"  🗑️  {table}: {count}건 삭제")
            except Exception as e:
                # 테이블 없으면 무시
                if "does not exist" in str(e) or "UndefinedTable" in str(e):
                    print(f"  ⏭️  {table}: 테이블 없음 (스킵)")
                    db.rollback()
                    db = SessionLocal()
                else:
                    raise

        db.commit()
        print()
        print("✅ 초기화 완료!")
        print()
        print("다음 단계:")
        print("  1. python -m scripts.seed_eval   ← 기본 체크리스트 데이터 재적재")
        print("  2. 앱에서 로그인  ← sync 자동 실행 (occurrence 생성)")

    except Exception as e:
        db.rollback()
        print(f"❌ 초기화 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # 실수 방지 확인
    confirm = input("정말 모든 평가 데이터를 삭제하시겠습니까? (yes 입력): ")
    if confirm.strip().lower() != "yes":
        print("취소됐습니다.")
        sys.exit(0)
    reset()
