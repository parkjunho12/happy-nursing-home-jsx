"""직원 계정 직종에 영양사 추가

Revision ID: e1d2e3f4a5b6
Revises: d0c1d2e3f4a5
"""
from alembic import op

revision = "e1d2e3f4a5b6"
down_revision = "d0c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE 는 트랜잭션 밖에서 실행해야 함
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userposition ADD VALUE IF NOT EXISTS '영양사'")


def downgrade():
    # Postgres enum 값 제거는 지원되지 않음 (no-op)
    pass
