"""add marketing_cta_events table

Revision ID: v8w9x0y1z2a3
Revises: u7v8w9x0y1z2
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "v8w9x0y1z2a3"
down_revision = "u7v8w9x0y1z2"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade():
    if not _has_table("marketing_cta_events"):
        op.create_table(
            "marketing_cta_events",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("page_path", sa.String(), nullable=True),
            sa.Column("page_title", sa.String(), nullable=True),
            sa.Column("component_name", sa.String(), nullable=True),
            sa.Column("section_name", sa.String(), nullable=True),
            sa.Column("button_label", sa.String(), nullable=True),
            sa.Column("destination", sa.String(), nullable=True),
            sa.Column("utm_source", sa.String(), nullable=True),
            sa.Column("utm_medium", sa.String(), nullable=True),
            sa.Column("utm_campaign", sa.String(), nullable=True),
            sa.Column("utm_term", sa.String(), nullable=True),
            sa.Column("utm_content", sa.String(), nullable=True),
            sa.Column("naver_query", sa.String(), nullable=True),
            sa.Column("naver_campaign_id", sa.String(), nullable=True),
            sa.Column("naver_adgroup_id", sa.String(), nullable=True),
            sa.Column("naver_keyword_id", sa.String(), nullable=True),
            sa.Column("naver_ad_id", sa.String(), nullable=True),
            sa.Column("session_id", sa.String(), nullable=True),
            sa.Column("device_type", sa.String(), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("ip_hash", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_marketing_cta_events_event_type", "marketing_cta_events", ["event_type"])
        op.create_index("ix_marketing_cta_events_page_path", "marketing_cta_events", ["page_path"])
        op.create_index("ix_marketing_cta_events_created_at", "marketing_cta_events", ["created_at"])


def downgrade():
    if _has_table("marketing_cta_events"):
        op.drop_table("marketing_cta_events")
