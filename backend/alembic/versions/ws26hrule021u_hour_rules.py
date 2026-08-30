"""근무 코드 시간을 달별로 — 시점 설정.

야간이 9시간에서 10시간으로 바뀌면 바뀐 달부터 그렇게 세야 한다.
하나의 값으로 두면 이미 급여를 지급한 지난달 숫자까지 함께 달라진다.

기존 code_hours(전체 기간)는 그대로 둔다. 지금 그 값을 쓰고 있는 곳이
있는데 옮기다 틀리면 급여 숫자가 조용히 달라진다. 시점 설정을 그 위에
얹는 방식이라 기존 동작이 바뀌지 않는다.

Revision ID: ws26hrule021u
Revises: ws26hours020t
"""
from alembic import op
import sqlalchemy as sa


revision = "ws26hrule021u"
down_revision = "ws26hours020t"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("work_schedule_config",
                  sa.Column("code_hours_rules", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("work_schedule_config", "code_hours_rules")
