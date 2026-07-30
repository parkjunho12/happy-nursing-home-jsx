"""프로그램 진행 시간 설정

Revision ID: b2d3e4f5a6b7
Revises: a1c1d2e3f4a5
"""
import sqlalchemy as sa
from alembic import op

revision = "b2d3e4f5a6b7"
down_revision = "a1c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "program_settings" not in insp.get_table_names():
        op.create_table(
            "program_settings",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("times", sa.JSON(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("program_settings")
