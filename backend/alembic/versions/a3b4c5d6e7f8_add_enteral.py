"""add enteral_products & enteral_transactions

Revision ID: a3b4c5d6e7f8
Revises: z2a3b4c5d6e7
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "a3b4c5d6e7f8"
down_revision = "z2a3b4c5d6e7"
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def upgrade():
    insp = _insp()
    if not insp.has_table("enteral_products"):
        op.create_table(
            "enteral_products",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("brand", sa.String(), nullable=True),
            sa.Column("unit", sa.String(), nullable=True, server_default="팩"),
            sa.Column("spec", sa.String(), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_enteral_products_name", "enteral_products", ["name"])

    if not insp.has_table("enteral_transactions"):
        op.create_table(
            "enteral_transactions",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("product_id", sa.String(), nullable=True),
            sa.Column("product_name", sa.String(), nullable=False),
            sa.Column("tx_type", sa.String(), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("resident_name", sa.String(), nullable=True),
            sa.Column("resident_id", sa.String(), nullable=True),
            sa.Column("tx_date", sa.String(), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_enteral_transactions_product_id", "enteral_transactions", ["product_id"])
        op.create_index("ix_enteral_transactions_tx_type", "enteral_transactions", ["tx_type"])
        op.create_index("ix_enteral_transactions_tx_date", "enteral_transactions", ["tx_date"])
        op.create_index("ix_enteral_transactions_created_at", "enteral_transactions", ["created_at"])


def downgrade():
    insp = _insp()
    if insp.has_table("enteral_transactions"):
        op.drop_table("enteral_transactions")
    if insp.has_table("enteral_products"):
        op.drop_table("enteral_products")
