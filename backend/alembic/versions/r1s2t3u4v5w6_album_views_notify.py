"""add family_album_views + albums.last_notified_at

Revision ID: r1s2t3u4v5w6
Revises: q0r1s2t3u4v5
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'r1s2t3u4v5w6'
down_revision = 'q0r1s2t3u4v5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)

    if "family_album_views" not in insp.get_table_names():
        op.create_table(
            "family_album_views",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("guardian_id", sa.String(), nullable=False),
            sa.Column("album_id", sa.String(), nullable=False),
            sa.Column("media_id", sa.String(), nullable=True),
            sa.Column("event_type", sa.String(length=16), nullable=False, server_default="open"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_family_album_views_guardian_id", "family_album_views", ["guardian_id"])
        op.create_index("ix_family_album_views_album_id", "family_album_views", ["album_id"])
        op.create_index("ix_family_album_views_created_at", "family_album_views", ["created_at"])
        op.create_index("ix_fav_album_event", "family_album_views", ["album_id", "event_type"])

    cols = [c["name"] for c in insp.get_columns("albums")]
    if "last_notified_at" not in cols:
        op.add_column("albums", sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("albums")]
    if "last_notified_at" in cols:
        op.drop_column("albums", "last_notified_at")
    if "family_album_views" in insp.get_table_names():
        op.drop_table("family_album_views")
