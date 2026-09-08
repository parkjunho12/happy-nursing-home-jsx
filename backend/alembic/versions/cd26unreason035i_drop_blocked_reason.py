"""불가 사유 칸을 걷어낸다 — 메모와 중복이라.

사유를 강제했더니 급할 때 아무 글자나 넣게 되고, 그러면 없느니만 못하다.
불가는 그냥 표시하고, 적을 것이 있으면 메모에 적는다. 메모는 불가와
상관없이 언제든 쓸 수 있어야 하므로 이미 있던 memo 칸을 쓴다.

blocked_reason 은 어제 만들어 오늘 걷어낸다. 실제로 담긴 값이 없다
(운영에서 불가 항목 0건인 것을 확인했다).

Revision ID: cd26unreason035i
Revises: cb26block034h
"""
from alembic import op
import sqlalchemy as sa


revision = "cd26unreason035i"
down_revision = "cb26block034h"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("checklist_items", "blocked_reason")


def downgrade() -> None:
    op.add_column("checklist_items",
                  sa.Column("blocked_reason", sa.Text(), nullable=True, server_default=""))
