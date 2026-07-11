"""add resident_doc_status

Revision ID: a0b1c2d3e4f5
Revises: z9a0b1c2d3e4
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'a0b1c2d3e4f5'
down_revision = 'z9a0b1c2d3e4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "resident_doc_status" in insp.get_table_names():
        return
    op.create_table(
        "resident_doc_status",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("resident_id", sa.String(), nullable=True),
        sa.Column("floor", sa.String(length=20), nullable=True, server_default="2층"),
        sa.Column("seq", sa.Integer(), server_default="0"),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("admission_date", sa.String(length=20), nullable=True),
        sa.Column("grade", sa.Text(), nullable=True),
        sa.Column("base_date", sa.String(length=20), nullable=True),
        sa.Column("cert_periods", sa.JSON(), nullable=True),
        sa.Column("contract_lines", sa.JSON(), nullable=True),
        sa.Column("plan_lines", sa.JSON(), nullable=True),
        sa.Column("eval_lines", sa.JSON(), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_resident_doc_status_resident_id", "resident_doc_status", ["resident_id"])
    op.create_index("ix_resident_doc_status_name", "resident_doc_status", ["name"])
    op.create_index("ix_resident_doc_status_active", "resident_doc_status", ["active"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "resident_doc_status" in insp.get_table_names():
        op.drop_table("resident_doc_status")
