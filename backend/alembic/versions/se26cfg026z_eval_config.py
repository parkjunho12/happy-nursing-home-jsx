"""평가 항목·배점을 설정에서 바꿀 수 있게.

항목은 시설마다 다르고 해마다 바뀐다. 코드에 박아 두면 바꿀 때마다 배포를
해야 하고, 그러면 결국 안 바꾸게 된다.

평가에 max_score 를 함께 저장한다. 이게 없으면 배점을 5→3 으로 바꾼 순간
지난 평가의 '5점'이 만점을 넘는 이상한 값이 된다. 인사 기록은 몇 년 뒤에
다시 꺼내 보는 것이라, 그때의 잣대가 함께 남아야 한다.

이미 저장된 평가는 그때 배점이 5였다 — 그렇게 채워 둔다.

Revision ID: se26cfg026z
Revises: se26eval025y
"""
from alembic import op
import sqlalchemy as sa


revision = "se26cfg026z"
down_revision = "se26eval025y"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("staff_evaluations", sa.Column("max_score", sa.Integer(), nullable=True))
    # 지금까지의 평가는 5점 만점이었다. 비워 두면 나중에 배점을 바꿨을 때
    # 지난 평가를 새 배점으로 잘못 읽는다.
    op.execute("UPDATE staff_evaluations SET max_score = 5 WHERE max_score IS NULL")

    op.create_table(
        "staff_eval_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("max_score", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("staff_eval_config")
    op.drop_column("staff_evaluations", "max_score")
