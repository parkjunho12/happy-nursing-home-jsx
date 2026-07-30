"""프로그램 변경 이력

Revision ID: z9b0c1d2e3f4
Revises: y8a9b0c1d2e3
"""
import sqlalchemy as sa
from alembic import op

revision = "z9b0c1d2e3f4"
down_revision = "y8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "program_change_logs" in insp.get_table_names():
        return
    op.create_table(
        "program_change_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("month", sa.String(7), nullable=False, index=True),
        sa.Column("day", sa.String(2), nullable=True),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("summary", sa.String(300), nullable=True),
        sa.Column("changed_by", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_table("program_change_logs")
