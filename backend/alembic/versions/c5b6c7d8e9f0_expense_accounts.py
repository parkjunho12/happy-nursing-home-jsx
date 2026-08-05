"""지출결의 — 입금·출금 통장, 지급 완료

Revision ID: c5b6c7d8e9f0
Revises: b4a5b6c7d8e9
"""
import sqlalchemy as sa
from alembic import op

revision = "c5b6c7d8e9f0"
down_revision = "b4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("expense_requests")}
    add = [("deposit_account", sa.String(120)), ("withdraw_account", sa.String(120)),
           ("paid_at", sa.DateTime(timezone=True)), ("paid_by", sa.String(100))]
    for name, typ in add:
        if name not in cols:
            op.add_column("expense_requests", sa.Column(name, typ, nullable=True))


def downgrade() -> None:
    for name in ("deposit_account", "withdraw_account", "paid_at", "paid_by"):
        op.drop_column("expense_requests", name)
