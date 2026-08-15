"""broadcast_devices: hostname / local_ip

Revision ID: bc26cast002b
Revises: bc26cast001a
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "bc26cast002b"
down_revision = "bc26cast001a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "broadcast_devices" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("broadcast_devices")}
    if "hostname" not in cols:
        op.add_column("broadcast_devices", sa.Column("hostname", sa.String(120), nullable=True))
    if "local_ip" not in cols:
        op.add_column("broadcast_devices", sa.Column("local_ip", sa.String(64), nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "broadcast_devices" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("broadcast_devices")}
    for c in ("local_ip", "hostname"):
        if c in cols:
            op.drop_column("broadcast_devices", c)
