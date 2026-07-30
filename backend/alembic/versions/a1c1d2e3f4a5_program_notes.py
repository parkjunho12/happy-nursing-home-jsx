"""프로그램 월 운영 규칙 메모

Revision ID: a1c1d2e3f4a5
Revises: z9b0c1d2e3f4
"""
import sqlalchemy as sa
from alembic import op

revision = "a1c1d2e3f4a5"
down_revision = "z9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("program_months")}
    if "notes" not in cols:
        op.add_column("program_months", sa.Column("notes", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("program_months", "notes")
