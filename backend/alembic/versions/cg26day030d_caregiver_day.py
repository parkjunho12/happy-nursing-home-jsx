"""요양보호사 하루 일정 — 근무 유형별 일과표 + 그날만의 일정.

사람×날짜로 두면 스무 명 × 서른 날 = 육백 칸을 매달 손으로 채워야 한다.
아무도 안 채우고, 안 채워진 앱은 다시 열지 않는다.

하루 일과를 가르는 것은 사람이 아니라 무슨 근무인가다. 그래서 일과표는
근무 코드별로 한 벌만 두고, 누가 그날 무슨 근무인지는 이미 근무표가
알고 있으니 둘을 맞춰 각자의 하루를 만든다.

'오늘 10시 교육' 처럼 그날만의 것은 날짜가 붙은 표에 따로 넣는다.

Revision ID: cg26day030d
Revises: as26snap029c
"""
from alembic import op
import sqlalchemy as sa


revision = "cg26day030d"
down_revision = "as26snap029c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "caregiver_routines",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("shift_code", sa.String(length=10), nullable=False),
        # 비어 있으면 모든 층 공통
        sa.Column("floor", sa.String(length=20), nullable=True),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=True),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_cg_routine_shift", "caregiver_routines", ["shift_code", "floor"])

    op.create_table(
        "caregiver_day_tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("staff_id", sa.String(), nullable=True),
        sa.Column("staff_name", sa.String(length=100), nullable=True),
        sa.Column("floor", sa.String(length=20), nullable=True),
        sa.Column("start_time", sa.String(length=5), nullable=True),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_cg_day_date", "caregiver_day_tasks", ["date"])


def downgrade() -> None:
    op.drop_table("caregiver_day_tasks")
    op.drop_table("caregiver_routines")
