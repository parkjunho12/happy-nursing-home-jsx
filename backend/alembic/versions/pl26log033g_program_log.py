"""그 회차에 무엇을 했는가 — 목표와 진행 내용.

지금 남는 것은 프로그램명과 시간뿐이라, 블로그 초안을 만들면 '기록에 활동
설명이 없어 활동명만 안내드립니다' 라는 글이 나온다. 여기 한두 줄만 있으면
그대로 본문이 된다.

사진 한 장이 아니라 회차(달·일·프로그램명)에 붙인다. 한 프로그램에 사진이
스무 장씩 올라오는데 사진마다 적게 하면 아무도 안 쓴다.

Revision ID: pl26log033g
Revises: wm26memo031e
"""
from alembic import op
import sqlalchemy as sa


revision = "pl26log033g"
down_revision = "wm26memo031e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "program_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("grp", sa.String(length=50), nullable=True),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("doing", sa.Text(), nullable=True),
        sa.Column("tools", sa.String(length=300), nullable=True),
        sa.Column("support", sa.Text(), nullable=True),
        sa.Column("joined", sa.String(length=100), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # 한 회차에 기록 한 벌
        sa.UniqueConstraint("month", "day", "title", name="uq_program_log_session"),
    )
    op.create_index("ix_program_log_month", "program_logs", ["month", "day"])


def downgrade() -> None:
    op.drop_table("program_logs")
