"""add naver_ad_bid_change_logs table

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "r4s5t6u7v8w9"
down_revision = "q3r4s5t6u7v8"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_index(table: str, index: str) -> bool:
    if not _has_table(table):
        return False
    return index in [i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)]


def upgrade():
    if not _has_table("naver_ad_bid_change_logs"):
        op.create_table(
            "naver_ad_bid_change_logs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("keyword_id", sa.String(), nullable=False),
            sa.Column("keyword", sa.String(), nullable=False),
            sa.Column("campaign_name", sa.String(), nullable=True),
            sa.Column("adgroup_name", sa.String(), nullable=True),
            sa.Column("old_bid", sa.Integer(), nullable=True),
            sa.Column("new_bid", sa.Integer(), nullable=True),
            sa.Column("change_rate", sa.Float(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("suggested_by", sa.String(), nullable=True),
            sa.Column("approved_by_user_id", sa.String(), nullable=True),
            sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="pending"),
            sa.Column("raw_response", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not _has_index("naver_ad_bid_change_logs", "ix_naver_ad_bid_change_logs_keyword_id"):
        op.create_index("ix_naver_ad_bid_change_logs_keyword_id", "naver_ad_bid_change_logs", ["keyword_id"])
    if not _has_index("naver_ad_bid_change_logs", "ix_naver_ad_bid_change_logs_approved_by_user_id"):
        op.create_index("ix_naver_ad_bid_change_logs_approved_by_user_id", "naver_ad_bid_change_logs", ["approved_by_user_id"])
    if not _has_index("naver_ad_bid_change_logs", "ix_naver_ad_bid_change_logs_status"):
        op.create_index("ix_naver_ad_bid_change_logs_status", "naver_ad_bid_change_logs", ["status"])


def downgrade():
    if _has_table("naver_ad_bid_change_logs"):
        op.drop_table("naver_ad_bid_change_logs")
