"""근무 코드별 시간을 설정으로 뺀다.

야간을 9시간으로 볼지 10시간으로 볼지는 시설이 정할 일이고, 실제로 바뀐다.
코드에 박아두면 바꿀 때마다 배포해야 하고, 그동안 급여 계산이 틀린 채로 돈다.

비워두면 코드의 기본값을 쓴다 — 지금 돌고 있는 값이 그대로 유지된다.

Revision ID: ws26hours020t
Revises: th26group019s
"""
from alembic import op
import sqlalchemy as sa


revision = "ws26hours020t"
down_revision = "th26group019s"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("work_schedule_config", sa.Column("code_hours", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("work_schedule_config", "code_hours")
