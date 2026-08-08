"""contract period history

Revision ID: op26per0002b
Revises: op26grp0001a
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "op26per0002b"
down_revision = "op26grp0001a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "operation_contracts" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("operation_contracts")]
    if "periods" not in cols:
        op.add_column("operation_contracts", sa.Column("periods", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("operation_contracts", "periods")
