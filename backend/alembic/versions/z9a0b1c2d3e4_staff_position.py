"""add position to ltc_staff_members (직종)

Revision ID: z9a0b1c2d3e4
Revises: y8z9a0b1c2d3
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'z9a0b1c2d3e4'
down_revision = 'y8z9a0b1c2d3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("ltc_staff_members")]
    if "position" not in cols:
        op.add_column("ltc_staff_members", sa.Column("position", sa.String(length=50), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("ltc_staff_members")]
    if "position" in cols:
        op.drop_column("ltc_staff_members", "position")
