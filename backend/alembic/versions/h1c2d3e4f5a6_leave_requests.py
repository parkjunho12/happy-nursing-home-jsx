"""직원 휴무 신청(leave_requests)

Revision ID: h1c2d3e4f5a6
Revises: g0b1c2d3e4f5
"""
from alembic import op
import sqlalchemy as sa

revision = "h1c2d3e4f5a6"
down_revision = "g0b1c2d3e4f5"
branch_labels = None
depends_on = None

TABLE = "leave_requests"


def upgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("staff_id", sa.String(), nullable=False, index=True),
        sa.Column("staff_name", sa.String(length=100), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True, index=True),
        sa.Column("date", sa.String(length=10), nullable=False, index=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True, index=True),
        sa.Column("decided_by", sa.String(length=100), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)
