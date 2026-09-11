"""어르신 식이 변경 기록.

Revision ID: dt26diet041q
Revises: rd26done040p
"""
from alembic import op
import sqlalchemy as sa

revision = "dt26diet041q"
down_revision = "rd26done040p"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resident_diet_changes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("resident_id", sa.String(), nullable=False),
        sa.Column("resident_name", sa.String(length=100), nullable=True),
        sa.Column("effective_date", sa.String(length=10), nullable=False),
        sa.Column("rice", sa.String(length=10), nullable=True),
        sa.Column("side", sa.String(length=10), nullable=True),
        sa.Column("tube", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("source", sa.String(length=10), nullable=False, server_default="manual"),
        sa.Column("changed_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_resident_diet_changes_resident_id", "resident_diet_changes", ["resident_id"])
    op.create_index("ix_resident_diet_changes_effective_date", "resident_diet_changes", ["effective_date"])
    op.create_index("ix_resident_diet_changes_created_at", "resident_diet_changes", ["created_at"])
    # 한 어르신의 기록을 날짜순으로 훑는 것이 이 표의 거의 유일한 조회다
    op.create_index("ix_diet_resident_date", "resident_diet_changes",
                    ["resident_id", "effective_date"])


def downgrade() -> None:
    op.drop_index("ix_diet_resident_date", table_name="resident_diet_changes")
    op.drop_index("ix_resident_diet_changes_created_at", table_name="resident_diet_changes")
    op.drop_index("ix_resident_diet_changes_effective_date", table_name="resident_diet_changes")
    op.drop_index("ix_resident_diet_changes_resident_id", table_name="resident_diet_changes")
    op.drop_table("resident_diet_changes")
