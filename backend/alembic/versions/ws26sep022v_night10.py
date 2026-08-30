"""2026년 9월부터 야간(N) 10시간.

시설에서 정한 값이다. 시점 설정으로 넣으므로 8월까지는 9시간 그대로 남고,
9월부터만 10시간으로 센다 — 이미 지급한 급여의 총시간이 바뀌지 않는다.

손으로 이미 설정해 둔 것이 있으면 건드리지 않는다. 화면에서 정해둔 값을
배포가 말없이 덮으면, 왜 바뀌었는지 아무도 모른다.

바꾸려면 근무표 → 조 편성 → 근무 코드 시간 → 시점 설정에서 고치면 된다.

Revision ID: ws26sep022v
Revises: ws26hrule021u
"""
from alembic import op
import sqlalchemy as sa
import json

revision = "ws26sep022v"
down_revision = "ws26hrule021u"
branch_labels = None
depends_on = None

RULES = [{"from": "2026-09", "hours": {"N": 10}}]


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(sa.text(
        "SELECT id, code_hours_rules FROM work_schedule_config LIMIT 1")).fetchone()

    if row is None:
        # 설정 행이 아직 없다 — 만들면서 함께 넣는다.
        # settle_start·rotation_anchor 는 앱이 쓰는 기본값과 같게 둔다.
        conn.execute(sa.text(
            "INSERT INTO work_schedule_config (id, settle_start, rotation_anchor, code_hours_rules) "
            "VALUES (:id, '2026-07', '2026-08-01', :r)"
        ).bindparams(id="cfg-default", r=json.dumps(RULES, ensure_ascii=False)))
        return

    cur = row[1]
    if cur:
        # 이미 시점 설정이 있다 — 사람이 정한 값이므로 그대로 둔다
        return
    conn.execute(sa.text(
        "UPDATE work_schedule_config SET code_hours_rules = :r WHERE id = :id"
    ).bindparams(id=row[0], r=json.dumps(RULES, ensure_ascii=False)))


def downgrade() -> None:
    # 우리가 넣은 것과 같을 때만 걷어낸다. 그 사이에 사람이 고쳤으면 놔둔다.
    conn = op.get_bind()
    row = conn.execute(sa.text(
        "SELECT id, code_hours_rules FROM work_schedule_config LIMIT 1")).fetchone()
    if row and row[1] == RULES:
        conn.execute(sa.text(
            "UPDATE work_schedule_config SET code_hours_rules = NULL WHERE id = :id"
        ).bindparams(id=row[0]))
