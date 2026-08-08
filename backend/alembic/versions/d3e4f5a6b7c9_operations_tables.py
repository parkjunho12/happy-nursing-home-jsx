"""operations contracts + payments

Revision ID: d3e4f5a6b7c9
Revises: c2d3e4f5a6b8
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "d3e4f5a6b7c9"
down_revision = "c2d3e4f5a6b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()
    if "operation_contracts" not in tables:
        op.create_table(
            "operation_contracts",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("section", sa.String(20), nullable=False, server_default="정기"),
            sa.Column("category", sa.String(100), nullable=False),
            sa.Column("vendor", sa.String(200), nullable=True),
            sa.Column("contact", sa.Text(), nullable=True),
            sa.Column("amount_note", sa.String(200), nullable=True),
            sa.Column("start_date", sa.String(20), nullable=True),
            sa.Column("end_date", sa.String(20), nullable=True),
            sa.Column("pay_day", sa.String(50), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
        )
    if "operation_pay_items" not in tables:
        op.create_table(
            "operation_pay_items",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("section", sa.String(20), nullable=False, server_default="정기"),
            sa.Column("category", sa.String(100), nullable=False),
            sa.Column("vendor", sa.String(200), nullable=True),
            sa.Column("method", sa.String(100), nullable=True),
            sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "operation_payments" not in tables:
        op.create_table(
            "operation_payments",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("item_id", sa.String(), sa.ForeignKey("operation_pay_items.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("year_month", sa.String(7), nullable=False, index=True),
            sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("paid_on", sa.String(20), nullable=True),
            sa.Column("note", sa.String(200), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("operation_payments")
    op.drop_table("operation_pay_items")
    op.drop_table("operation_contracts")
