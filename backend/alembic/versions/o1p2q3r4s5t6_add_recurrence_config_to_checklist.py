"""add recurrence config columns to checklist_items

Revision ID: o1p2q3r4s5t6
Revises: n1o2p3q4r5s6
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa

revision = "o1p2q3r4s5t6"
down_revision = "n1o2p3q4r5s6"
branch_labels = None
depends_on = None


def _has_column(table: str, col: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return col in [c["name"] for c in inspector.get_columns(table)]


COLUMNS = ["recur_weekday", "recur_week_of_month", "recur_day", "recur_due_day"]


def upgrade():
    for col in COLUMNS:
        if not _has_column("checklist_items", col):
            op.add_column(
                "checklist_items",
                sa.Column(col, sa.Integer(), nullable=True),
            )


def downgrade():
    for col in reversed(COLUMNS):
        if _has_column("checklist_items", col):
            op.drop_column("checklist_items", col)
