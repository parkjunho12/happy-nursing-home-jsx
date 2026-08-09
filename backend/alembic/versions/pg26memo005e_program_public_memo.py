"""program public memo

Revision ID: pg26memo005e
Revises: op26exp0004d
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "pg26memo005e"
down_revision = "op26exp0004d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "program_months" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("program_months")]
    if "public_memo" not in cols:
        op.add_column("program_months", sa.Column("public_memo", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("program_months", "public_memo")
