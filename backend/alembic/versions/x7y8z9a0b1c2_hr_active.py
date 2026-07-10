"""add active to staff_hr_records (퇴사 숨김)

Revision ID: x7y8z9a0b1c2
Revises: w6x7y8z9a0b1
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'x7y8z9a0b1c2'
down_revision = 'w6x7y8z9a0b1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("staff_hr_records")]
    if "active" not in cols:
        op.add_column("staff_hr_records", sa.Column("active", sa.Boolean(), server_default=sa.true()))
        op.create_index("ix_staff_hr_records_active", "staff_hr_records", ["active"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("staff_hr_records")]
    if "active" in cols:
        op.drop_column("staff_hr_records", "active")
