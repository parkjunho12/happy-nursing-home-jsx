"""외출·외박 분류 분리 — 기존 데이터는 외출로

Revision ID: s2a3b4c5d6e7
Revises: r1f2a3b4c5d6
"""
import sqlalchemy as sa
from alembic import op

revision = "s2a3b4c5d6e7"
down_revision = "r1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE schedule_events SET category = '외출' WHERE category = '외출·외박'")


def downgrade() -> None:
    pass
