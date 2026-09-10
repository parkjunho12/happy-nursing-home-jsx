"""입소일까지의 서류 일시를 완료로 굳힌다.

■ 왜

  입소일 이전 일시는 우리 원에 오시기 전 기록이고, 입소일 당일 것은 입소
  절차에서 그 자리에 받는 서류다. 어느 쪽도 지금 챙길 것이 없다.

  화면은 이미 그렇게 읽고 있었다(effStatus 의 isUpToAdmission). 다만 저장된
  값은 비어 있거나 '챙길것' 그대로여서, 표에 체크 표시가 안 붙고 상태 칸도
  사람이 고른 것인지 화면이 계산한 것인지 구분이 안 됐다. 보이는 것과 적힌
  것을 같게 맞춘다.

■ 무엇을 건드리지 않는가

  · 입소일이 없는 어르신 — 기준이 없으니 판단하지 않는다
  · 입소일 뒤의 일시 — 앞으로 챙겨야 하는 서류다
  · 날짜가 없는 일시('시설급여 나온시점' 같은 것)

  사람이 '미비'·'서명미비'로 표시해 둔 것도 함께 완료로 바꾼다. 요청대로다.
  다만 그런 건이 몇이었는지는 따로 세어 로그에 남긴다 — 되돌아볼 수 있게.

■ 기록

  바뀐 어르신마다 서류 수정 이력에 한 줄을 남긴다. 화면의 「수정 이력」에서
  그대로 보인다. 아무도 모르게 바뀌는 일이 없도록.

■ 되돌리기

  downgrade 는 아무것도 하지 않는다. 완료로 바꾸기 전 값을 따로 보관하지
  않기 때문이다. 되돌릴 일이 생기면 이력에 남은 건수를 보고 손으로 고친다.

Revision ID: rd26done040p
Revises: bd26blog032f
"""
import json
import uuid
from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa

revision = "rd26done040p"
down_revision = "bd26blog032f"
branch_labels = None
depends_on = None

KST = timezone(timedelta(hours=9))
FIELDS = [("contract_lines", "계약서 일시"),
          ("plan_lines", "급여제공계획서 일시"),
          ("eval_lines", "급여제공 결과평가 일시")]


def _events(raw):
    """저장된 값을 일시 목록으로 읽는다.

    옛 기록은 문자열 목록이었다 — 그건 날짜가 없으니 건드릴 것이 없다.
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return None
    return raw if isinstance(raw, list) else None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, name, admission_date, contract_lines, plan_lines, eval_lines "
        "FROM resident_doc_status")).mappings().all()

    people = 0        # 바뀐 어르신 수
    marked = 0        # 완료로 바꾼 일시 수
    overridden = 0    # 사람이 미비·서명미비로 두었던 것
    no_adm = 0        # 입소일이 없어 건너뛴 어르신

    for r in rows:
        adm = (r["admission_date"] or "").strip()
        if len(adm) != 10:
            no_adm += 1
            continue

        updates, notes = {}, []
        for field, label in FIELDS:
            evs = _events(r[field])
            if not evs:
                continue
            changed = 0
            for e in evs:
                if not isinstance(e, dict):
                    continue                       # 옛 문자열 기록 — 날짜가 없다
                d = (e.get("date") or "").strip()
                if len(d) != 10 or d > adm:
                    continue
                if e.get("status") == "완료" and e.get("done"):
                    continue                       # 이미 완료
                if e.get("status") in ("미비", "서명미비"):
                    overridden += 1
                e["status"] = "완료"
                e["done"] = True
                changed += 1
            if changed:
                updates[field] = evs
                notes.append(f"{label} {changed}건")
                marked += changed

        if not updates:
            continue
        people += 1
        sets = ", ".join(f"{f} = :{f}" for f in updates)
        conn.execute(
            sa.text(f"UPDATE resident_doc_status SET {sets} WHERE id = :id"),
            {**{f: json.dumps(v, ensure_ascii=False) for f, v in updates.items()},
             "id": r["id"]})

        # 이력 한 줄 — 화면의 「수정 이력」에 그대로 보인다
        conn.execute(sa.text(
            "INSERT INTO resident_doc_changes "
            "(id, doc_id, resident_name, action, changes, user_name, created_at) "
            "VALUES (:id, :doc_id, :nm, 'update', :ch, :who, :at)"), {
            "id": str(uuid.uuid4()),
            "doc_id": r["id"],
            "nm": r["name"],
            "ch": json.dumps([{
                "field": "doc_lines",
                "label": "입소일까지의 서류 일시",
                "before": "완료 표시 없음",
                "after": f"완료 처리 ({' · '.join(notes)})",
            }], ensure_ascii=False),
            "who": "시스템 일괄 정리",
            "at": datetime.now(KST),
        })

    print(f"[입소일까지 완료 처리] 어르신 {people}명 · 일시 {marked}건 "
          f"(미비·서명미비였던 것 {overridden}건) · 입소일 없어 건너뜀 {no_adm}명")


def downgrade() -> None:
    # 바꾸기 전 값을 보관하지 않았다. 되돌리려면 이력을 보고 손으로 고친다.
    pass
