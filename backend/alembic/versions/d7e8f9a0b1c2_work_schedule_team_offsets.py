"""work_schedule: 조별 주주야야휴휴 시작 위치

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
"""
from alembic import op
import sqlalchemy as sa

revision = "d7e8f9a0b1c2"
down_revision = "c6d7e8f9a0b1"
branch_labels = None
depends_on = None


def _table(insp):
    names = insp.get_table_names()
    return "work_schedules" if "work_schedules" in names else ("work_schedule" if "work_schedule" in names else None)


def upgrade():
    insp = sa.inspect(op.get_bind())
    t = _table(insp)
    if not t:
        return
    if "team_offsets" not in {c["name"] for c in insp.get_columns(t)}:
        op.add_column(t, sa.Column("team_offsets", sa.JSON(), nullable=True))


def downgrade():
    insp = sa.inspect(op.get_bind())
    t = _table(insp)
    if t and "team_offsets" in {c["name"] for c in insp.get_columns(t)}:
        op.drop_column(t, "team_offsets")
