"""입소 상담 — 부부 상담 묶기.

부부는 한 통화에서 두 분을 상담하지만 기록은 한 분에 한 장이다.
등급·건강 상태가 사람마다 다르고, 한 분만 입소하게 되는 경우가 잦아
한 장에 섞어 적으면 그때 기록을 쪼갤 수 없다. 두 장을 서로 가리키게 묶는다.

Revision ID: cp26cu049y
Revises: cs26ct048x
"""
from alembic import op
import sqlalchemy as sa

revision = "cp26cu049y"
down_revision = "cs26ct048x"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("consults", sa.Column("partner_id", sa.String(), nullable=True))
    op.add_column("consults", sa.Column("couple_room", sa.String(length=30), nullable=True))
    op.add_column("consults", sa.Column("cost_guided", sa.String(length=40), nullable=True))
    op.create_index("ix_consults_partner_id", "consults", ["partner_id"])


def downgrade() -> None:
    op.drop_index("ix_consults_partner_id", table_name="consults")
    op.drop_column("consults", "cost_guided")
    op.drop_column("consults", "couple_room")
    op.drop_column("consults", "partner_id")
