"""직원 평가(인사고과) — 반기마다 한 번.

(직원, 기간)에 unique 를 건다. 같은 반기에 평가가 둘이면 어느 것이 맞는지
알 수 없고, 이건 재계약이나 급여로 이어지는 기록이다.

평가 항목을 함께 저장한다(items). 항목은 언젠가 바뀌는데, 점수만 남으면
'3점'이 무엇에 대한 3점이었는지 몇 년 뒤에 알 수 없다.

Revision ID: se26eval025y
Revises: au26memo024x
"""
from alembic import op
import sqlalchemy as sa


revision = "se26eval025y"
down_revision = "au26memo024x"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "staff_evaluations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("staff_id", sa.String(), nullable=False),
        sa.Column("period", sa.String(length=10), nullable=False),
        sa.Column("scores", sa.JSON(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("evaluator_id", sa.String(), nullable=True),
        sa.Column("evaluator_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("staff_id", "period", name="uq_staff_eval_staff_period"),
    )
    op.create_index("ix_staff_evaluations_staff_id", "staff_evaluations", ["staff_id"])
    op.create_index("ix_staff_eval_period", "staff_evaluations", ["period"])


def downgrade() -> None:
    op.drop_table("staff_evaluations")
