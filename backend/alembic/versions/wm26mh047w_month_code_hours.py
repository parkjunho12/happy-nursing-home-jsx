"""근무표 — 그 달만의 근무 코드 시간.

시점 설정(그 달부터 쭉)과 달리 그 달 하나에만 적용된다. 그 달만 실제
근무시간이 달랐던 경우, 시점으로 적으면 다음 달까지 끌려간다.

Revision ID: wm26mh047w
Revises: bq26pq046v
"""
from alembic import op
import sqlalchemy as sa

revision = "wm26mh047w"
down_revision = "bq26pq046v"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("work_schedule_config", sa.Column("code_hours_months", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("work_schedule_config", "code_hours_months")
