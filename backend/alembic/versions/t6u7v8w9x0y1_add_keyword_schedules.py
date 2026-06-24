"""add naver_ad_keyword_schedules table

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "t6u7v8w9x0y1"
down_revision = "s5t6u7v8w9x0"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade():
    if not _has_table("naver_ad_keyword_schedules"):
        op.create_table(
            "naver_ad_keyword_schedules",
            sa.Column("keyword_id", sa.String(), primary_key=True),
            sa.Column("keyword", sa.String(), nullable=True),
            sa.Column("campaign_name", sa.String(), nullable=True),
            sa.Column("adgroup_name", sa.String(), nullable=True),
            sa.Column("adgroup_id", sa.String(), nullable=True),
            sa.Column("hourly_bids", sa.Text(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("updated_by", sa.String(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade():
    if _has_table("naver_ad_keyword_schedules"):
        op.drop_table("naver_ad_keyword_schedules")
