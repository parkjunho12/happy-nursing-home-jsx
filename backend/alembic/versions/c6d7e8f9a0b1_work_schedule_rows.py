"""work_schedule: 행 구성(직종·조) + 기준시간/일수 + 작성 기준일

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
"""
from alembic import op
import sqlalchemy as sa

revision = "c6d7e8f9a0b1"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None

TABLE = "work_schedules"
COLS = [("rows", sa.JSON()), ("base_hours", sa.String(length=10)),
        ("base_days", sa.String(length=10)), ("as_of", sa.String(length=20))]


def upgrade():
    insp = sa.inspect(op.get_bind())
    names = insp.get_table_names()
    table = TABLE if TABLE in names else ("work_schedule" if "work_schedule" in names else None)
    if not table:
        return
    have = {c["name"] for c in insp.get_columns(table)}
    for name, type_ in COLS:
        if name not in have:
            op.add_column(table, sa.Column(name, type_, nullable=True))


def downgrade():
    insp = sa.inspect(op.get_bind())
    names = insp.get_table_names()
    table = TABLE if TABLE in names else ("work_schedule" if "work_schedule" in names else None)
    if not table:
        return
    have = {c["name"] for c in insp.get_columns(table)}
    for name, _ in COLS:
        if name in have:
            op.drop_column(table, name)
