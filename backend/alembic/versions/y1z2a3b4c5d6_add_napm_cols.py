"""add NaPm tracker columns to marketing_cta_events

Revision ID: y1z2a3b4c5d6
Revises: x0y1z2a3b4c5
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "y1z2a3b4c5d6"
down_revision = "x0y1z2a3b4c5"
branch_labels = None
depends_on = None

_COLS = [
    ("naver_napm", sa.String()),
    ("naver_napm_ci", sa.String()),
    ("naver_napm_tr", sa.String()),
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
    # ci 인덱스(있으면 skip)
    insp = sa.inspect(op.get_bind())
    if insp.has_table("marketing_cta_events"):
        idx = {i["name"] for i in insp.get_indexes("marketing_cta_events")}
        if "ix_marketing_cta_events_naver_napm_ci" not in idx and "naver_napm_ci" in _existing("marketing_cta_events"):
            op.create_index("ix_marketing_cta_events_naver_napm_ci", "marketing_cta_events", ["naver_napm_ci"])


def downgrade():
    have = _existing("marketing_cta_events")
    insp = sa.inspect(op.get_bind())
    if insp.has_table("marketing_cta_events"):
        idx = {i["name"] for i in insp.get_indexes("marketing_cta_events")}
        if "ix_marketing_cta_events_naver_napm_ci" in idx:
            op.drop_index("ix_marketing_cta_events_naver_napm_ci", table_name="marketing_cta_events")
    for name, _ in _COLS:
        if name in have:
            op.drop_column("marketing_cta_events", name)
