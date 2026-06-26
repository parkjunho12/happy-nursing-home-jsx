"""add unit_price to enteral products & transactions

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def _cols(table: str):
    insp = sa.inspect(op.get_bind())
    if not insp.has_table(table):
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def upgrade():
    if "unit_price" not in _cols("enteral_products"):
        op.add_column("enteral_products", sa.Column("unit_price", sa.Integer(), nullable=True))
    if "unit_price" not in _cols("enteral_transactions"):
        op.add_column("enteral_transactions", sa.Column("unit_price", sa.Integer(), nullable=True))


def downgrade():
    if "unit_price" in _cols("enteral_transactions"):
        op.drop_column("enteral_transactions", "unit_price")
    if "unit_price" in _cols("enteral_products"):
        op.drop_column("enteral_products", "unit_price")
