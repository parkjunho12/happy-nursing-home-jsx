"""add public column to internal_notices (공개 공지 링크 열람)

Revision ID: c4d5e6f7a8b9
Revises: e0f1a2b3c4d5
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'c4d5e6f7a8b9'
down_revision = 'e0f1a2b3c4d5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("internal_notices")]
    if "public" not in cols:
        op.add_column(
            "internal_notices",
            sa.Column("public", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.create_index("ix_internal_notices_public", "internal_notices", ["public"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("internal_notices")]
    if "public" in cols:
        try:
            op.drop_index("ix_internal_notices_public", table_name="internal_notices")
        except Exception:
            pass
        op.drop_column("internal_notices", "public")
