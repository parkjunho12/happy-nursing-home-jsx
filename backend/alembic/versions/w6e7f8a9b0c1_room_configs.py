"""층·호실 설정

Revision ID: w6e7f8a9b0c1
Revises: v5d6e7f8a9b0
"""
import sqlalchemy as sa
from alembic import op

revision = "w6e7f8a9b0c1"
down_revision = "v5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "room_configs" in insp.get_table_names():
        return
    op.create_table(
        "room_configs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("floor", sa.String(20), nullable=False, index=True),
        sa.Column("room", sa.String(10), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("room_configs")
