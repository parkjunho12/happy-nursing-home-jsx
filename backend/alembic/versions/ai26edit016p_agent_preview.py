"""AI 페이지 편집기 — 에이전트에 '상시 미리보기' 상태를 붙인다.

작업을 걸어야만 미리보기가 생기던 구조였다. 그러면 '무엇을 고칠지' 를
화면을 보면서 정할 수가 없다 — 먼저 고칠 것을 정해야 화면이 나오니까,
순서가 거꾸로다.

그래서 에이전트가 작업이 없을 때 기준 브랜치로 미리보기를 하나 띄워 둔다.
여기 붙는 값들은 '지금 그 자리에 무엇이 떠 있는가' 와 '화면이 무엇을
보여달라고 했는가' 를 담는다.

Revision ID: ai26edit016p
Revises: ai26edit015o
"""
from alembic import op
import sqlalchemy as sa


revision = "ai26edit016p"
down_revision = "ai26edit015o"
branch_labels = None
depends_on = None


# (이름, 길이) — 전부 nullable 이다. 기존 행은 '아직 모른다' 로 남는다.
COLS = [
    ("preview_kind", 10),      # base | job
    ("preview_service", 40),
    ("preview_state", 12),     # off|starting|installing|ready|failed
    ("preview_url", 300),
    ("preview_msg", 300),
    ("want_service", 40),
]


def upgrade() -> None:
    for name, length in COLS:
        op.add_column("ai_edit_agents",
                      sa.Column(name, sa.String(length=length), nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLS):
        op.drop_column("ai_edit_agents", name)
