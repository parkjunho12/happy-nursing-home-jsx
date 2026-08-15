"""broadcast_devices: clock_skew_sec

Revision ID: bc26cast003c
Revises: bc26cast002b
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "bc26cast003c"
down_revision = "bc26cast002b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "broadcast_devices" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("broadcast_devices")}
    if "clock_skew_sec" not in cols:
        op.add_column("broadcast_devices", sa.Column("clock_skew_sec", sa.Integer(), nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "broadcast_devices" not in insp.get_table_names():
        return
    if "clock_skew_sec" in {c["name"] for c in insp.get_columns("broadcast_devices")}:
        op.drop_column("broadcast_devices", "clock_skew_sec")
