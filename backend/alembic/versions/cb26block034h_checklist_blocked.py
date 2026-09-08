"""체크리스트 '불가' 상태와 사유.

할 수 없는 항목을 미완료로 두면 영원히 빨간 채로 남아 '아직 못 한 일' 과
'할 수 없는 일' 이 섞인다. 그렇다고 완료로 찍으면 하지 않은 일을 했다고
기록하는 것이 된다. 그래서 셋째 상태를 둔다.

사유를 함께 남긴다. 왜 못 하는지가 없으면 나중에 아무도 판단할 수 없고,
감사에서도 '안 한 것' 과 구별되지 않는다.

Revision ID: cb26block034h
Revises: pl26log033g
"""
from alembic import op
import sqlalchemy as sa


revision = "cb26block034h"
down_revision = "pl26log033g"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("checklist_items",
                  sa.Column("blocked", sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column("checklist_items",
                  sa.Column("blocked_reason", sa.Text(), nullable=True, server_default=""))
    op.add_column("checklist_items",
                  sa.Column("blocked_by", sa.String(length=100), nullable=True))
    op.add_column("checklist_items",
                  sa.Column("blocked_date", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("checklist_items", "blocked_date")
    op.drop_column("checklist_items", "blocked_by")
    op.drop_column("checklist_items", "blocked_reason")
    op.drop_column("checklist_items", "blocked")
