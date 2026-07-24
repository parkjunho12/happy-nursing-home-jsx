"""저장된 전자서명 — 신청 때마다 다시 그리지 않게

Revision ID: r1f2a3b4c5d6
Revises: q0e1f2a3b4c5
"""
import sqlalchemy as sa
from alembic import op

revision = "r1f2a3b4c5d6"
down_revision = "q0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("users")}
    if "saved_signature_url" not in cols:
        op.add_column("users", sa.Column("saved_signature_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "saved_signature_url")
