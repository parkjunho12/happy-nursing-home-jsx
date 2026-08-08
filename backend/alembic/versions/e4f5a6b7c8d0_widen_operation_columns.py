"""widen operation contract text columns

Revision ID: e4f5a6b7c8d0
Revises: d3e4f5a6b7c9
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "e4f5a6b7c8d0"
down_revision = "d3e4f5a6b7c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "operation_contracts" not in insp.get_table_names():
        return
    op.alter_column("operation_contracts", "start_date", type_=sa.String(50), existing_type=sa.String(20))
    op.alter_column("operation_contracts", "end_date", type_=sa.String(50), existing_type=sa.String(20))
    op.alter_column("operation_contracts", "pay_day", type_=sa.String(100), existing_type=sa.String(50))


def downgrade() -> None:
    op.alter_column("operation_contracts", "start_date", type_=sa.String(20), existing_type=sa.String(50))
    op.alter_column("operation_contracts", "end_date", type_=sa.String(20), existing_type=sa.String(50))
    op.alter_column("operation_contracts", "pay_day", type_=sa.String(50), existing_type=sa.String(100))
