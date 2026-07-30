"""수급자 종교·프로그램 그룹 등급

Revision ID: c3e4f5a6b7c8
Revises: b2d3e4f5a6b7
"""
import sqlalchemy as sa
from alembic import op

revision = "c3e4f5a6b7c8"
down_revision = "b2d3e4f5a6b7"
branch_labels = None
depends_on = None

COLS = [
    ("religion", sa.String(20)),
    ("group_cognitive", sa.String(2)),
    ("group_leisure", sa.String(2)),
    ("group_physical", sa.String(2)),
]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    existing = {c["name"] for c in insp.get_columns("ltc_residents")}
    for name, typ in COLS:
        if name not in existing:
            op.add_column("ltc_residents", sa.Column(name, typ, nullable=True))


def downgrade() -> None:
    for name, _ in COLS:
        op.drop_column("ltc_residents", name)
