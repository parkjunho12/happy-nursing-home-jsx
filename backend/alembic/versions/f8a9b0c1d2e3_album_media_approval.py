"""add approval status to album_media

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa

revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def _cols():
    insp = sa.inspect(op.get_bind())
    if not insp.has_table("album_media"):
        return set()
    return {c["name"] for c in insp.get_columns("album_media")}


def upgrade():
    have = _cols()
    if not have:
        return
    if "status" not in have:
        op.add_column("album_media", sa.Column("status", sa.String(length=12), nullable=False, server_default="approved"))
        op.create_index("ix_album_media_status", "album_media", ["status"])
    if "uploaded_by" not in have:
        op.add_column("album_media", sa.Column("uploaded_by", sa.String(), nullable=True))
    if "approved_by" not in have:
        op.add_column("album_media", sa.Column("approved_by", sa.String(), nullable=True))
    if "approved_at" not in have:
        op.add_column("album_media", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    have = _cols()
    for c in ("approved_at", "approved_by", "uploaded_by"):
        if c in have:
            op.drop_column("album_media", c)
    if "status" in have:
        try:
            op.drop_index("ix_album_media_status", table_name="album_media")
        except Exception:
            pass
        op.drop_column("album_media", "status")
