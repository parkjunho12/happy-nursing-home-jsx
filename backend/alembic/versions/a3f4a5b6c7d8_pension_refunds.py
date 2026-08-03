"""퇴직연금 퇴사자 환급

Revision ID: a3f4a5b6c7d8
Revises: f2e3f4a5b6c7
"""
import sqlalchemy as sa
from alembic import op

revision = "a3f4a5b6c7d8"
down_revision = "f2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "pension_refunds" not in insp.get_table_names():
        op.create_table(
            "pension_refunds",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("staff_id", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("amount", sa.Integer(), nullable=True),
            sa.Column("refund_date", sa.String(10), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("pension_refunds")
