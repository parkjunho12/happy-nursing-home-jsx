"""담당 어르신 명단에 함께 붙는 메모.

어르신 한 분에 대한 이야기가 아니라, 그 명단을 보는 사람들이 다 같이 알아야
하는 것을 적는 자리다. 한 줄만 둔다 — 여럿이 각자 적으면 어느 것이 지금
유효한지 알 수 없고, 명단은 벽에 붙는 문서라 붙어 있는 것이 곧 지침이어야 한다.

Revision ID: an26note028b
Revises: eb26bell027a
"""
from alembic import op
import sqlalchemy as sa


revision = "an26note028b"
down_revision = "eb26bell027a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assign_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("assign_notes")
