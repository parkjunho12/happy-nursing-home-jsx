"""일정 ↔ 공개 공지 연결

Revision ID: q0e1f2a3b4c5
Revises: p9d0e1f2a3b4
"""
import sqlalchemy as sa
from alembic import op

revision = "q0e1f2a3b4c5"
down_revision = "p9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("schedule_events")}
    if "notice_id" not in cols:
        op.add_column("schedule_events", sa.Column("notice_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("schedule_events", "notice_id")
