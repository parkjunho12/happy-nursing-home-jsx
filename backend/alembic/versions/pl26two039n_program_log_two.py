"""회차 기록을 두 칸으로 — 목표와 프로그램 내용.

처음에는 목표·진행·도구·참여·직원 도움·마무리 여섯 칸이었다. 무엇을 적을지
알려주려던 것인데, 여섯 칸이 비어 있으면 '다 채워야 하나' 싶어 손이 안 간다.
실제로 한 달 동안 한 건도 안 적혔다.

두 칸이면 적는다. 그리고 이 둘이면 블로그 본문이 나온다 — 도구·참여·마무리는
'프로그램 내용' 안에 자연스럽게 들어간다.

담긴 값이 없는 것을 확인하고 지운다(전 기간 0건).

Revision ID: pl26two039n
Revises: ds26sop038m
"""
from alembic import op
import sqlalchemy as sa


revision = "pl26two039n"
down_revision = "ds26sop038m"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for col in ("tools", "support", "joined", "outcome"):
        op.drop_column("program_logs", col)


def downgrade() -> None:
    op.add_column("program_logs", sa.Column("tools", sa.String(length=300), nullable=True))
    op.add_column("program_logs", sa.Column("support", sa.Text(), nullable=True))
    op.add_column("program_logs", sa.Column("joined", sa.String(length=100), nullable=True))
    op.add_column("program_logs", sa.Column("outcome", sa.Text(), nullable=True))
