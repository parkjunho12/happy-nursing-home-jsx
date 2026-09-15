"""블로그 사진 점수 — 같은 활동 사진 중 선명하고 밝은 쪽부터 쓴다.

Revision ID: bq26pq046v
Revises: hr26rrn045u
"""
from alembic import op
import sqlalchemy as sa

revision = "bq26pq046v"
down_revision = "hr26rrn045u"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blog_photo_uses", sa.Column("quality", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("blog_photo_uses", "quality")
