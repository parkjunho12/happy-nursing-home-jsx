"""주간 식단표

Revision ID: e5b6c7d8e9f0
Revises: d4f5a6b7c8d9
"""
import sqlalchemy as sa
from alembic import op

revision = "e5b6c7d8e9f0"
down_revision = "d4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "meal_weeks" not in insp.get_table_names():
        op.create_table(
            "meal_weeks",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("start", sa.String(10), nullable=False, unique=True, index=True),
            sa.Column("end", sa.String(10), nullable=False),
            sa.Column("days", sa.JSON(), nullable=True),
            sa.Column("notes", sa.JSON(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("meal_weeks")
