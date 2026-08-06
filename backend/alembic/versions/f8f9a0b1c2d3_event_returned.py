"""일정 — 실제 귀원 기록

Revision ID: f8f9a0b1c2d3
Revises: e7e8f9a0b1c2
"""
import sqlalchemy as sa
from alembic import op

revision = "f8f9a0b1c2d3"
down_revision = "e7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("schedule_events")}
    if "returned_at" not in cols:
        op.add_column("schedule_events", sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True))
        op.add_column("schedule_events", sa.Column("returned_by", sa.String(), nullable=True))
        # 기능 도입 전에 만들어진 외출·외박·외래 일정은 일괄 '귀원 처리'로 채워
        # 귀원 대기함이 옛 일정으로 넘치지 않게 한다. (오늘 시작분부터는 정상 추적)
        op.execute(
            "UPDATE schedule_events "
            "SET returned_at = COALESCE(end_at, start_at), "
            "    returned_by = '자동(기능 도입 전 일정)' "
            "WHERE category IN ('외출', '외박', '외래·병원') "
            "AND (start_at AT TIME ZONE 'Asia/Seoul')::date < (NOW() AT TIME ZONE 'Asia/Seoul')::date"
        )


def downgrade() -> None:
    op.drop_column("schedule_events", "returned_at")
    op.drop_column("schedule_events", "returned_by")
