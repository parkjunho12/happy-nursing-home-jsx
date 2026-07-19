"""handover_reports + users.handover_access (인수인계 AI)

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind(); insp = inspect(bind)
    if "handover_reports" not in insp.get_table_names():
        op.create_table(
            "handover_reports",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("images", sa.JSON(), nullable=True),
            sa.Column("report", sa.JSON(), nullable=True),
            sa.Column("model", sa.String(length=100), nullable=True),
            sa.Column("author", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_handover_reports_created_at", "handover_reports", ["created_at"])
    if "users" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("users")]
        if "handover_access" not in cols:
            op.add_column("users", sa.Column("handover_access", sa.Boolean(), nullable=True,
                                             server_default=sa.false()))


def downgrade():
    bind = op.get_bind(); insp = inspect(bind)
    if "users" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("users")]
        if "handover_access" in cols:
            op.drop_column("users", "handover_access")
    if "handover_reports" in insp.get_table_names():
        try: op.drop_index("ix_handover_reports_created_at", table_name="handover_reports")
        except Exception: pass
        op.drop_table("handover_reports")
