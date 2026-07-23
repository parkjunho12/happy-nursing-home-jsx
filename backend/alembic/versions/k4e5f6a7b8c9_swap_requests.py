"""맞교대 신청(swap_requests)

Revision ID: k4e5f6a7b8c9
Revises: j3d4e5f6a7b8
"""
from alembic import op
import sqlalchemy as sa

revision = "k4e5f6a7b8c9"
down_revision = "j3d4e5f6a7b8"
branch_labels = None
depends_on = None

TABLE = "swap_requests"


def upgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("requester_staff_id", sa.String(), nullable=False, index=True),
        sa.Column("requester_name", sa.String(length=100), nullable=True),
        sa.Column("requester_user_id", sa.String(), nullable=True),
        sa.Column("partner_staff_id", sa.String(), nullable=False, index=True),
        sa.Column("partner_name", sa.String(length=100), nullable=True),
        sa.Column("partner_user_id", sa.String(), nullable=True),
        sa.Column("dates", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requester_signature_url", sa.Text(), nullable=True),
        sa.Column("partner_signature_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True, index=True),
        sa.Column("decided_by", sa.String(length=100), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)
