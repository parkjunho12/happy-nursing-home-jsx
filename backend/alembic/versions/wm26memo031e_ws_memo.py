"""그 달, 그 선생님에 대한 메모.

근무표의 '비고' 열에 적으면 안 된다. 조 편성은 이번 달이 비어 있으면 지난달
것을 이어받고, 비고도 함께 따라온다 — 8월에 적은 메모가 9월에 떠 있으면
읽는 사람은 그것을 9월 이야기로 안다.

확정 잠금도 걸린다. 벽에 붙인 뒤에도 사람에 대한 메모는 계속 생기는데,
메모 한 줄 적으려고 근무표 잠금을 풀게 할 수는 없다. 저장할 때마다 근무표
버전이 쌓이는 것도 곤란하다 — 되돌리기 이력이 메모로 뒤덮인다.

그래서 표를 따로 둔다. 근무표의 잠금·버전·수정시각을 건드리지 않는다.

Revision ID: wm26memo031e
Revises: cg26day030d
"""
from alembic import op
import sqlalchemy as sa


revision = "wm26memo031e"
down_revision = "cg26day030d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_schedule_memos",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("year_month", sa.String(length=7), nullable=False),
        sa.Column("staff_id", sa.String(), nullable=False),
        sa.Column("memo", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # 한 달에 한 사람 한 칸 — 둘이면 어느 것이 그 사람 메모인지 알 수 없다
        sa.UniqueConstraint("year_month", "staff_id", name="uq_ws_memo_month_staff"),
    )
    op.create_index("ix_ws_memo_month", "work_schedule_memos", ["year_month"])


def downgrade() -> None:
    op.drop_table("work_schedule_memos")
