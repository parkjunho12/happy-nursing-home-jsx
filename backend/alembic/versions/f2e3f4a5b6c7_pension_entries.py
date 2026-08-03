"""퇴직연금 적립 대장

Revision ID: f2e3f4a5b6c7
Revises: e1d2e3f4a5b6
"""
import sqlalchemy as sa
from alembic import op

revision = "f2e3f4a5b6c7"
down_revision = "e1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "pension_entries" not in insp.get_table_names():
        op.create_table(
            "pension_entries",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("staff_id", sa.String(), nullable=False, index=True),
            sa.Column("month", sa.String(7), nullable=False, index=True),
            sa.Column("wage", sa.Integer(), nullable=True),
            sa.Column("accrued", sa.Integer(), nullable=True),
            sa.Column("deposited", sa.Integer(), nullable=True),
            sa.Column("deposit_date", sa.String(10), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("staff_id", "month", name="uq_pension_staff_month"),
        )


def downgrade() -> None:
    op.drop_table("pension_entries")
