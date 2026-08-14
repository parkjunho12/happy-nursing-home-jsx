"""admin monthly routines (ADMIN 전용 월간 업무)

Revision ID: ar26mon0001a
Revises: pg26memo005e
Create Date: 2026-08-14
"""
from alembic import op
import sqlalchemy as sa

revision = "ar26mon0001a"
down_revision = "pg26memo005e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()

    if "admin_routines" not in tables:
        op.create_table(
            "admin_routines",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("day", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("category", sa.String(50), nullable=False, server_default="기타"),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "admin_routine_dones" not in tables:
        op.create_table(
            "admin_routine_dones",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("routine_id", sa.String(), nullable=False),
            sa.Column("period_key", sa.String(7), nullable=False),
            sa.Column("done_date", sa.String(10), nullable=False),
            sa.Column("done_by", sa.String(100), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("routine_id", "period_key", name="uq_admin_routine_period"),
        )
        op.create_index("ix_admin_routine_dones_routine_id", "admin_routine_dones", ["routine_id"])
        op.create_index("ix_admin_routine_dones_period_key", "admin_routine_dones", ["period_key"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()
    if "admin_routine_dones" in tables:
        op.drop_table("admin_routine_dones")
    if "admin_routines" in tables:
        op.drop_table("admin_routines")
