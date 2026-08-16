"""자동 방송 설정 표 (체위변경 안내 등)

Revision ID: bc26auto006f
Revises: rs26pos0005e
"""
from alembic import op
import sqlalchemy as sa

revision = "bc26auto006f"
down_revision = "rs26pos0005e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 자동 방송 종류마다 표를 새로 만들지 않는다 — key 로 나눠 한 표에 담는다
    op.create_table(
        "broadcast_auto_settings",
        sa.Column("key", sa.String(30), primary_key=True),
        sa.Column("value", sa.JSON(), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("broadcast_auto_settings")
