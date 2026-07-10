"""add started_by/started_at to checklist_occurrences (진행 중)

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 't3u4v5w6x7y8'
down_revision = 's2t3u4v5w6x7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("checklist_occurrences")]
    if "started_by" not in cols:
        op.add_column("checklist_occurrences", sa.Column("started_by", sa.String(length=100), nullable=True))
    if "started_at" not in cols:
        op.add_column("checklist_occurrences", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("checklist_occurrences")]
    if "started_at" in cols:
        op.drop_column("checklist_occurrences", "started_at")
    if "started_by" in cols:
        op.drop_column("checklist_occurrences", "started_by")
