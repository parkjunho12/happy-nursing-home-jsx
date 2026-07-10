"""add staff_push_tokens

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'u4v5w6x7y8z9'
down_revision = 't3u4v5w6x7y8'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "staff_push_tokens" in insp.get_table_names():
        return
    op.create_table(
        "staff_push_tokens",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), server_default="android"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_staff_push_tokens_user_id", "staff_push_tokens", ["user_id"])
    op.create_index("ix_staff_push_tokens_token", "staff_push_tokens", ["token"], unique=True)


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "staff_push_tokens" in insp.get_table_names():
        op.drop_table("staff_push_tokens")
