"""
frequency 표기 정규화 스크립트 (1회성)

문제:
  일부 체크리스트가 'half_yearly'(언더스코어)로 저장되어 있어
  프론트 필터/라벨과 백엔드 주기 계산('half-yearly' 기준)에 걸리지 않음.

조치:
  checklist_items / checklist_occurrences 의 frequency 값을 표준값으로 통일한다.
    half_yearly, halfyearly, semiannual, semi_annual → half-yearly

실행 (backend/ 디렉토리에서):
  python -m scripts.normalize_frequency           # 변경 미리보기(dry-run)
  python -m scripts.normalize_frequency --apply   # 실제 반영
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.eval import ChecklistItem, ChecklistOccurrence

ALIASES = {
    "half_yearly": "half-yearly",
    "halfyearly": "half-yearly",
    "semiannual": "half-yearly",
    "semi_annual": "half-yearly",
}


def normalize(freq):
    if not freq:
        return freq
    key = str(freq).strip()
    return ALIASES.get(key, ALIASES.get(key.lower(), key))


def run(apply: bool):
    db = SessionLocal()
    try:
        changed = 0
        for model, label in ((ChecklistItem, "checklist_items"),
                             (ChecklistOccurrence, "checklist_occurrences")):
            rows = db.query(model).all()
            for r in rows:
                new = normalize(r.frequency)
                if new != r.frequency:
                    print(f"[{label}] {r.id}: {r.frequency!r} -> {new!r}")
                    if apply:
                        r.frequency = new
                    changed += 1
        if apply:
            db.commit()
            print(f"\n반영 완료: {changed}건 수정")
        else:
            print(f"\n미리보기: {changed}건 변경 예정 (실제 반영하려면 --apply)")
    finally:
        db.close()


if __name__ == "__main__":
    run("--apply" in sys.argv[1:])
