"""수급자 입소 예정 시간

Revision ID: f6c7d8e9f0a1
Revises: e5b6c7d8e9f0
"""
import sqlalchemy as sa
from alembic import op

revision = "f6c7d8e9f0a1"
down_revision = "e5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("ltc_residents")}
    if "admission_time" not in cols:
        op.add_column("ltc_residents", sa.Column("admission_time", sa.String(5), nullable=True))


def downgrade() -> None:
    op.drop_column("ltc_residents", "admission_time")
