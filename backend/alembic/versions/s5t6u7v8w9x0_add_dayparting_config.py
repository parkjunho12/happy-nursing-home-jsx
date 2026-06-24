"""add naver_ads_dayparting_config table

Revision ID: s5t6u7v8w9x0
Revises: r4s5t6u7v8w9
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "s5t6u7v8w9x0"
down_revision = "r4s5t6u7v8w9"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade():
    if not _has_table("naver_ads_dayparting_config"):
        op.create_table(
            "naver_ads_dayparting_config",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("campaign_id", sa.String(), nullable=True),
            sa.Column("adgroup_id", sa.String(), nullable=True),
            sa.Column("hour_multipliers", sa.Text(), nullable=True),
            sa.Column("weekday_multipliers", sa.Text(), nullable=True),
            sa.Column("base_bids", sa.Text(), nullable=True),
            sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("min_bid", sa.Integer(), nullable=False, server_default="70"),
            sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_run_summary", sa.Text(), nullable=True),
            sa.Column("updated_by", sa.String(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade():
    if _has_table("naver_ads_dayparting_config"):
        op.drop_table("naver_ads_dayparting_config")
