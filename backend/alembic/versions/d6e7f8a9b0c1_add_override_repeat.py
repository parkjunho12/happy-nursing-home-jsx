"""add repeat/daily columns to naver_ad_bid_overrides

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def _cols():
    insp = sa.inspect(op.get_bind())
    if not insp.has_table("naver_ad_bid_overrides"):
        return set()
    return {c["name"] for c in insp.get_columns("naver_ad_bid_overrides")}


def upgrade():
    have = _cols()
    if not have:
        return
    if "repeat" not in have:
        op.add_column("naver_ad_bid_overrides", sa.Column("repeat", sa.String(), nullable=False, server_default="once"))
    if "daily_start" not in have:
        op.add_column("naver_ad_bid_overrides", sa.Column("daily_start", sa.String(), nullable=True))
    if "daily_end" not in have:
        op.add_column("naver_ad_bid_overrides", sa.Column("daily_end", sa.String(), nullable=True))
    # start_at/end_at → nullable (daily 모드는 미사용)
    try:
        op.alter_column("naver_ad_bid_overrides", "start_at", existing_type=sa.DateTime(timezone=True), nullable=True)
        op.alter_column("naver_ad_bid_overrides", "end_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    except Exception:
        pass


def downgrade():
    have = _cols()
    for c in ("daily_end", "daily_start", "repeat"):
        if c in have:
            op.drop_column("naver_ad_bid_overrides", c)
