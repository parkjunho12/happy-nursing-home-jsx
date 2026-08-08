"""contract group column

Revision ID: op26cgr0003c
Revises: op26per0002b
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "op26cgr0003c"
down_revision = "op26per0002b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "operation_contracts" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("operation_contracts")]
    if "grp" not in cols:
        op.add_column("operation_contracts", sa.Column("grp", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("operation_contracts", "grp")
