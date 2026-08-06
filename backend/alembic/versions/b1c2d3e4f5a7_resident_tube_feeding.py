"""수급자 경관식 여부

Revision ID: b1c2d3e4f5a7
Revises: a9b0c1d2e3f5
"""
import sqlalchemy as sa
from alembic import op

revision = "b1c2d3e4f5a7"
down_revision = "a9b0c1d2e3f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("ltc_residents")}
    if "tube_feeding" not in cols:
        op.add_column("ltc_residents", sa.Column("tube_feeding", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("ltc_residents", "tube_feeding")
