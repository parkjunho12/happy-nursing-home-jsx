"""프로그램 일정·그룹 분류

Revision ID: y8a9b0c1d2e3
Revises: x7f8a9b0c1d2
"""
import sqlalchemy as sa
from alembic import op

revision = "y8a9b0c1d2e3"
down_revision = "x7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()
    if "program_months" not in tables:
        op.create_table(
            "program_months",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("month", sa.String(7), nullable=False, unique=True, index=True),
            sa.Column("days", sa.JSON(), nullable=True),
            sa.Column("published", sa.Boolean(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "program_group_sets" not in tables:
        op.create_table(
            "program_group_sets",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("based_on", sa.String(10), nullable=False, unique=True, index=True),
            sa.Column("data", sa.JSON(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("program_group_sets")
    op.drop_table("program_months")
