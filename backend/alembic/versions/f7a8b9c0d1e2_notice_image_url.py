"""add image_url to internal_notices & notice_templates (공유 이미지)

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'f7a8b9c0d1e2'
down_revision = 'e6f7a8b9c0d1'
branch_labels = None
depends_on = None


def _add(table):
    bind = op.get_bind()
    insp = inspect(bind)
    if table not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns(table)]
    if "image_url" not in cols:
        op.add_column(table, sa.Column("image_url", sa.String(), nullable=True))


def _drop(table):
    bind = op.get_bind()
    insp = inspect(bind)
    if table not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns(table)]
    if "image_url" in cols:
        op.drop_column(table, "image_url")


def upgrade():
    _add("internal_notices")
    _add("notice_templates")


def downgrade():
    _drop("notice_templates")
    _drop("internal_notices")
