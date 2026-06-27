"""add '앨범담당' to userposition enum

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-06-27
"""
from alembic import op

revision = "e7f8a9b0c1d2"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE 는 트랜잭션 밖에서 실행해야 함
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userposition ADD VALUE IF NOT EXISTS '앨범담당'")


def downgrade():
    # Postgres enum 값 제거는 지원되지 않음 (no-op)
    pass
