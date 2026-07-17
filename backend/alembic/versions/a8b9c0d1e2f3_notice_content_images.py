"""add content_images to internal_notices (본문 갤러리 이미지)

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'a8b9c0d1e2f3'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "internal_notices" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("internal_notices")]
    if "content_images" not in cols:
        op.add_column("internal_notices", sa.Column("content_images", sa.JSON(), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "internal_notices" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("internal_notices")]
        if "content_images" in cols:
            op.drop_column("internal_notices", "content_images")
