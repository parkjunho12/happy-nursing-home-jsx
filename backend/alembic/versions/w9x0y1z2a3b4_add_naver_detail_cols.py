"""add naver detail columns to marketing_cta_events

Revision ID: w9x0y1z2a3b4
Revises: v8w9x0y1z2a3
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "w9x0y1z2a3b4"
down_revision = "v8w9x0y1z2a3"
branch_labels = None
depends_on = None

_COLS = [
    ("naver_keyword", sa.String()),
    ("naver_rank", sa.String()),
    ("naver_media", sa.String()),
    ("naver_match_type", sa.String()),
    ("naver_campaign_type", sa.String()),
]


def _existing(table: str):
    insp = sa.inspect(op.get_bind())
    if not insp.has_table(table):
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def upgrade():
    have = _existing("marketing_cta_events")
    for name, col_type in _COLS:
        if name not in have:
            op.add_column("marketing_cta_events", sa.Column(name, col_type, nullable=True))


def downgrade():
    have = _existing("marketing_cta_events")
    for name, _ in _COLS:
        if name in have:
            op.drop_column("marketing_cta_events", name)
