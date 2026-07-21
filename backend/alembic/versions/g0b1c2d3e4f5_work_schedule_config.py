"""근무표 전역 설정(정산 시작월·회전 기준일) — 연도 하드코딩 제거

Revision ID: g0b1c2d3e4f5
Revises: f9a0b1c2d3e4
"""
import uuid
from alembic import op
import sqlalchemy as sa

revision = "g0b1c2d3e4f5"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None

TABLE = "work_schedule_config"


def upgrade():
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("settle_start", sa.String(length=7), nullable=True),
        sa.Column("rotation_anchor", sa.String(length=10), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    # 기존 동작과 동일한 기본값을 심는다 (지금까지 코드에 박혀 있던 값)
    t = sa.table(TABLE, sa.column("id", sa.String),
                 sa.column("settle_start", sa.String), sa.column("rotation_anchor", sa.String))
    op.bulk_insert(t, [{"id": str(uuid.uuid4()), "settle_start": "2026-07", "rotation_anchor": "2026-08-01"}])


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)
