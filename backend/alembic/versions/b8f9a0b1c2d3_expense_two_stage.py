"""지출결의 2단계 승인 — 시설장 1차

Revision ID: b8f9a0b1c2d3
Revises: a7d8e9f0a1b2
"""
import sqlalchemy as sa
from alembic import op

revision = "b8f9a0b1c2d3"
down_revision = "a7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("expense_requests")}
    if "manager_id" not in cols:
        op.add_column("expense_requests", sa.Column("manager_id", sa.String(), nullable=True))
        op.add_column("expense_requests", sa.Column("manager_name", sa.String(100), nullable=True))
        op.add_column("expense_requests", sa.Column("manager_approved_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for c in ("manager_id", "manager_name", "manager_approved_at"):
        op.drop_column("expense_requests", c)
