"""resident discharge_time

Revision ID: c2d3e4f5a6b8
Revises: b1c2d3e4f5a7
Create Date: 2026-08-06
"""
from alembic import op
import sqlalchemy as sa

revision = "c2d3e4f5a6b8"
down_revision = "b1c2d3e4f5a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = [c["name"] for c in insp.get_columns("ltc_residents")]
    if "discharge_time" not in cols:
        op.add_column("ltc_residents", sa.Column("discharge_time", sa.String(5), nullable=True))


def downgrade() -> None:
    op.drop_column("ltc_residents", "discharge_time")
