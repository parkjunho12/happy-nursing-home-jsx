"""지출 계좌 설정에 카드 목록

Revision ID: e7e8f9a0b1c2
Revises: d6d7e8f9a0b1
"""
import sqlalchemy as sa
from alembic import op

revision = "e7e8f9a0b1c2"
down_revision = "d6d7e8f9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("expense_account_settings")}
    if "cards" not in cols:
        op.add_column("expense_account_settings", sa.Column("cards", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("expense_account_settings", "cards")
