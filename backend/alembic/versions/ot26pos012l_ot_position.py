"""작업치료사 직종 추가 — 물리치료사와 같은 권한

Revision ID: ot26pos012l
Revises: pg26pic011k
"""
from alembic import op

revision = "ot26pos012l"
down_revision = "pg26pic011k"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # ENUM 값 추가는 트랜잭션 안에서 쓸 수 없다 — autocommit 으로 뺀다
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE userposition ADD VALUE IF NOT EXISTS '작업치료사'")


def downgrade() -> None:
    # ENUM 값은 지울 수 없다(쓰고 있는 행이 있으면 더더욱).
    # 되돌릴 것이 없으므로 아무것도 하지 않는다.
    pass
