"""담당 어르신 명단의 그날 모습.

바뀔 때마다 그날 명단을 통째로 박아 둔다. 이력(로그)으로 되감아 만들면
그 사이 입·퇴소하신 분과 한 번도 안 바뀐 분을 다 맞춰야 하는데, 하나라도
어긋나면 '그날 누가 담당이었나' 에 틀린 답을 준다. 사고가 났을 때 책임
소재를 따지는 질문이라, 그럴듯하게 틀린 답을 내놓는 것이 제일 나쁘다.

하루에 한 장 — 여러 번 바뀌면 덮어쓴다. 그날 마지막 모습이 남는다.

Revision ID: as26snap029c
Revises: an26note028b
"""
from alembic import op
import sqlalchemy as sa


revision = "as26snap029c"
down_revision = "an26note028b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assign_snapshots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("rows", sa.JSON(), nullable=False),
        sa.Column("memo", sa.String(length=1000), nullable=True),
        sa.Column("changed_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    # 하루에 한 장 — 같은 날짜가 둘이면 어느 것이 그날 모습인지 알 수 없다
    op.create_index("ix_assign_snapshot_date", "assign_snapshots", ["date"], unique=True)


def downgrade() -> None:
    op.drop_table("assign_snapshots")
