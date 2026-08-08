"""external position + allowed menus

Revision ID: ext26menu001
Revises: op26cgr0003c
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "ext26menu001"
down_revision = "op26cgr0003c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE userposition ADD VALUE IF NOT EXISTS '외부담당'")
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "allowed_menus" not in cols:
        op.add_column("users", sa.Column("allowed_menus", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "allowed_menus")
