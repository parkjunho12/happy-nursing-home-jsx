"""근무표 개인별 한 줄 설명

Revision ID: t3b4c5d6e7f8
Revises: s2a3b4c5d6e7
"""
import sqlalchemy as sa
from alembic import op

revision = "t3b4c5d6e7f8"
down_revision = "s2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("work_schedules")}
    if "notes" not in cols:
        op.add_column("work_schedules", sa.Column("notes", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("work_schedules", "notes")
