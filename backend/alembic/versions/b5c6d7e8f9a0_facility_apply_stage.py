"""resident_doc_status: 시설급여 신청 단계 + 보호자 안내일

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
"""
from alembic import op
import sqlalchemy as sa

revision = "b5c6d7e8f9a0"
down_revision = "a4b5c6d7e8f9"
branch_labels = None
depends_on = None

TABLE = "resident_doc_status"
COLS = [
    ("apply_stage", sa.String(length=20)),
    ("apply_note", sa.Text()),
    ("guardian_notified_at", sa.String(length=20)),
]


def upgrade():
    insp = sa.inspect(op.get_bind())
    if TABLE not in insp.get_table_names():
        return
    have = {c["name"] for c in insp.get_columns(TABLE)}
    for name, type_ in COLS:
        if name not in have:
            op.add_column(TABLE, sa.Column(name, type_, nullable=True))
    # 등급외·재가로 이미 분류된 어르신은 '예정'부터 시작
    op.execute(f"UPDATE {TABLE} SET apply_stage = '예정' "
               f"WHERE apply_stage IS NULL AND care_type IN ('재가', '신청예정')")


def downgrade():
    insp = sa.inspect(op.get_bind())
    if TABLE not in insp.get_table_names():
        return
    have = {c["name"] for c in insp.get_columns(TABLE)}
    for name, _ in COLS:
        if name in have:
            op.drop_column(TABLE, name)
