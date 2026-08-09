"""operation payment expense link

Revision ID: op26exp0004d
Revises: ext26menu001
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "op26exp0004d"
down_revision = "ext26menu001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "operation_payments" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("operation_payments")]
    if "expense_id" not in cols:
        op.add_column("operation_payments", sa.Column("expense_id", sa.String(), nullable=True))
        op.create_index("ix_operation_payments_expense_id", "operation_payments", ["expense_id"])


def downgrade() -> None:
    op.drop_index("ix_operation_payments_expense_id", table_name="operation_payments")
    op.drop_column("operation_payments", "expense_id")
