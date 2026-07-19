"""work_schedules table — 월별 근무표

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'd1e2f3a4b5c6'
down_revision = 'c0d1e2f3a4b5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind(); insp = inspect(bind)
    if "work_schedules" not in insp.get_table_names():
        op.create_table(
            "work_schedules",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("year_month", sa.String(length=7), nullable=False),
            sa.Column("data", sa.JSON(), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_work_schedules_year_month", "work_schedules", ["year_month"], unique=True)


def downgrade():
    bind = op.get_bind(); insp = inspect(bind)
    if "work_schedules" in insp.get_table_names():
        try: op.drop_index("ix_work_schedules_year_month", table_name="work_schedules")
        except Exception: pass
        op.drop_table("work_schedules")
