"""체크리스트 완료자 기록

Revision ID: c9b0c1d2e3f4
Revises: b8f9a0b1c2d3
"""
import sqlalchemy as sa
from alembic import op

revision = "c9b0c1d2e3f4"
down_revision = "b8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("checklist_occurrences")}
    if "completed_by" not in cols:
        op.add_column("checklist_occurrences", sa.Column("completed_by", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("checklist_occurrences", "completed_by")
