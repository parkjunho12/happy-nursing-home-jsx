"""근무표 확정 잠금

Revision ID: ws26lock010j
Revises: op26link009i
"""
from alembic import op
import sqlalchemy as sa

revision = "ws26lock010j"
down_revision = "op26link009i"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 확정한 근무표가 조용히 바뀌면 사람마다 다른 표를 보게 된다.
    # 잠근 사람과 시각을 남겨 누가 확정했는지 알 수 있게 한다.
    op.add_column("work_schedules", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("work_schedules", sa.Column("locked_by", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("work_schedules", "locked_by")
    op.drop_column("work_schedules", "locked_at")
