"""add facility_news (시설소식)

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 's2t3u4v5w6x7'
down_revision = 'r1s2t3u4v5w6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "facility_news" in insp.get_table_names():
        return
    op.create_table(
        "facility_news",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("category", sa.String(length=20), nullable=False, server_default="일반"),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.false()),
        sa.Column("is_published", sa.Boolean(), server_default=sa.true()),
        sa.Column("author_id", sa.String(), nullable=True),
        sa.Column("author_name", sa.String(length=100), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_facility_news_category", "facility_news", ["category"])
    op.create_index("ix_facility_news_is_published", "facility_news", ["is_published"])
    op.create_index("ix_facility_news_created_at", "facility_news", ["created_at"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "facility_news" in insp.get_table_names():
        op.drop_table("facility_news")
