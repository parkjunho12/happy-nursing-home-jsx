"""add staff_hr_records (+seed)

Revision ID: v5w6x7y8z9a0
Revises: u4v5w6x7y8z9
Create Date: 2026-07-09
"""
import uuid
from datetime import datetime, timezone, timedelta
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'v5w6x7y8z9a0'
down_revision = 'u4v5w6x7y8z9'
branch_labels = None
depends_on = None

KST = timezone(timedelta(hours=9))


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "staff_hr_records" not in insp.get_table_names():
        op.create_table(
            "staff_hr_records",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("seq", sa.Integer(), server_default="0"),
            sa.Column("hire_date", sa.String(length=20), nullable=True),
            sa.Column("name", sa.String(length=100), nullable=True),
            sa.Column("position", sa.String(length=50), nullable=True),
            sa.Column("contract_period", sa.Text(), nullable=True),
            sa.Column("contract_written", sa.Boolean(), server_default=sa.false()),
            sa.Column("renewal_date", sa.String(length=20), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("doc_health", sa.Boolean(), nullable=True),
            sa.Column("doc_criminal", sa.Boolean(), nullable=True),
            sa.Column("doc_cert", sa.Boolean(), nullable=True),
            sa.Column("doc_resident", sa.Boolean(), nullable=True),
            sa.Column("doc_family", sa.Boolean(), nullable=True),
            sa.Column("doc_id_copy", sa.Boolean(), nullable=True),
            sa.Column("doc_bankbook", sa.Boolean(), nullable=True),
            sa.Column("doc_insurance", sa.Boolean(), nullable=True),
            sa.Column("doc_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_staff_hr_records_seq", "staff_hr_records", ["seq"])
        op.create_index("ix_staff_hr_records_name", "staff_hr_records", ["name"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "staff_hr_records" in insp.get_table_names():
        op.drop_table("staff_hr_records")
