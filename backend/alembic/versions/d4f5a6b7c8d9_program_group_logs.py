"""수급자 그룹·종교 변경 이력

Revision ID: d4f5a6b7c8d9
Revises: c3e4f5a6b7c8
"""
import sqlalchemy as sa
from alembic import op

revision = "d4f5a6b7c8d9"
down_revision = "c3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "program_group_logs" not in insp.get_table_names():
        op.create_table(
            "program_group_logs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("resident_name", sa.String(100), nullable=False),
            sa.Column("field", sa.String(10), nullable=False),
            sa.Column("before", sa.String(20), nullable=True),
            sa.Column("after", sa.String(20), nullable=True),
            sa.Column("changed_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, index=True),
        )


def downgrade() -> None:
    op.drop_table("program_group_logs")
