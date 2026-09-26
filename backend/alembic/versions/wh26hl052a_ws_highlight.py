"""근무표 형광펜 — 그 달 그 칸(또는 그 날 전체)에 '여기 봐라' 표시.

근무표는 벽에 붙인 뒤에도 바뀐다. 2일 근무가 바뀌고, 누가 대휴를 당겼다.
다시 붙여도 사람들은 지난달과 똑같이 생긴 표에서 어디가 달라졌는지 못 찾는다.
종이라면 형광펜으로 긋는다 — 그것을 그대로 옮긴다.

근무 코드(data)에 섞지 않는다. 시간 계산·자동 편성·되돌리기가 전부 그 값을
읽으므로 '강조됨'을 끼워 넣으면 형광펜을 근무로 오해할 길이 생긴다.

메모와 같은 이유로 근무표 문서와 따로 둔다 — 확정 잠금이 걸린 뒤에 긋는
것이 형광펜이라, 긋자고 잠금을 풀 수는 없다. 잠금·버전·수정시각을 안 건드린다.

staff_id 가 빈 문자열이면 그 날 전체(열)를 그은 것이다.

Revision ID: wh26hl052a
Revises: wa26ca051a
"""
from alembic import op
import sqlalchemy as sa


revision = "wh26hl052a"
down_revision = "wa26ca051a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_schedule_highlights",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("year_month", sa.String(length=7), nullable=False),
        sa.Column("staff_id", sa.String(), nullable=False, server_default=""),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="yellow"),
        sa.Column("note", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # 한 달, 한 칸에 하나 — 둘이면 어느 색이 그 칸 색인지 알 수 없다
        sa.UniqueConstraint("year_month", "staff_id", "day", name="uq_ws_hl_month_staff_day"),
    )
    op.create_index("ix_ws_hl_month", "work_schedule_highlights", ["year_month"])


def downgrade() -> None:
    op.drop_table("work_schedule_highlights")
