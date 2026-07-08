"""add due_date to checklist_items (one_time 기한)

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'p9q0r1s2t3u4'
down_revision = 'o8p9q0r1s2t3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("checklist_items")]
    if "due_date" not in cols:
        op.add_column("checklist_items", sa.Column("due_date", sa.String(length=20), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("checklist_items")]
    if "due_date" in cols:
        op.drop_column("checklist_items", "due_date")
