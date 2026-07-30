"""카드키 보증금 이체(반환) 상태

Revision ID: x7f8a9b0c1d2
Revises: w6e7f8a9b0c1
"""
import sqlalchemy as sa
from alembic import op

revision = "x7f8a9b0c1d2"
down_revision = "w6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("card_keys")}
    if "refunded" not in cols:
        op.add_column("card_keys", sa.Column("refunded", sa.Boolean(), nullable=True))
    if "refund_date" not in cols:
        op.add_column("card_keys", sa.Column("refund_date", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("card_keys", "refund_date")
    op.drop_column("card_keys", "refunded")
