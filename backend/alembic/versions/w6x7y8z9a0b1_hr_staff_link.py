"""add staff_id to staff_hr_records

Revision ID: w6x7y8z9a0b1
Revises: v5w6x7y8z9a0
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'w6x7y8z9a0b1'
down_revision = 'v5w6x7y8z9a0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("staff_hr_records")]
    if "staff_id" not in cols:
        op.add_column("staff_hr_records", sa.Column("staff_id", sa.String(), nullable=True))
        op.create_index("ix_staff_hr_records_staff_id", "staff_hr_records", ["staff_id"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("staff_hr_records")]
    if "staff_id" in cols:
        op.drop_column("staff_hr_records", "staff_id")
