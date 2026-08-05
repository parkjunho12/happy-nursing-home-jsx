"""지출결의 계좌 목록 설정

Revision ID: d6d7e8f9a0b1
Revises: c5b6c7d8e9f0
"""
import sqlalchemy as sa
from alembic import op

revision = "d6d7e8f9a0b1"
down_revision = "c5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "expense_account_settings" not in insp.get_table_names():
        op.create_table(
            "expense_account_settings",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("withdraw_accounts", sa.JSON(), nullable=True),
            sa.Column("deposit_accounts", sa.JSON(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("expense_account_settings")
