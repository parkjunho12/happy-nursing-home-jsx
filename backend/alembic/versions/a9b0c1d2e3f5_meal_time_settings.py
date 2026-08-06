"""식사 시간 설정 — 식수 정산 기준

Revision ID: a9b0c1d2e3f5
Revises: f8f9a0b1c2d3
"""
import sqlalchemy as sa
from alembic import op

revision = "a9b0c1d2e3f5"
down_revision = "f8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "meal_time_settings" not in insp.get_table_names():
        op.create_table(
            "meal_time_settings",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("breakfast", sa.String(5), nullable=True),
            sa.Column("snack_am", sa.String(5), nullable=True),
            sa.Column("lunch", sa.String(5), nullable=True),
            sa.Column("snack_pm", sa.String(5), nullable=True),
            sa.Column("dinner", sa.String(5), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("meal_time_settings")
