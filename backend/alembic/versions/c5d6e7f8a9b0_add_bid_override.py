"""add naver_ad_bid_overrides

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade():
    insp = sa.inspect(op.get_bind())
    if insp.has_table("naver_ad_bid_overrides"):
        return
    op.create_table(
        "naver_ad_bid_overrides",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("keyword_id", sa.String(), nullable=False),
        sa.Column("keyword", sa.String(), nullable=True),
        sa.Column("adgroup_id", sa.String(), nullable=True),
        sa.Column("adgroup_name", sa.String(), nullable=True),
        sa.Column("campaign_name", sa.String(), nullable=True),
        sa.Column("override_bid", sa.Integer(), nullable=False),
        sa.Column("original_bid", sa.Integer(), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reverted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_nabo_keyword_id", "naver_ad_bid_overrides", ["keyword_id"])
    op.create_index("ix_nabo_status", "naver_ad_bid_overrides", ["status"])
    op.create_index("ix_nabo_start_at", "naver_ad_bid_overrides", ["start_at"])
    op.create_index("ix_nabo_end_at", "naver_ad_bid_overrides", ["end_at"])


def downgrade():
    insp = sa.inspect(op.get_bind())
    if insp.has_table("naver_ad_bid_overrides"):
        op.drop_table("naver_ad_bid_overrides")
