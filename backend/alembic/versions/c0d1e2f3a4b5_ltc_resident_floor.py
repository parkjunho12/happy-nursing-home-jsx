"""add floor to ltc_residents (어르신 생활 층)

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'c0d1e2f3a4b5'
down_revision = 'b9c0d1e2f3a4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind(); insp = inspect(bind)
    if "ltc_residents" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("ltc_residents")]
    if "floor" not in cols:
        op.add_column("ltc_residents", sa.Column("floor", sa.String(length=20), nullable=True))
        op.create_index("ix_ltc_residents_floor", "ltc_residents", ["floor"])


def downgrade():
    bind = op.get_bind(); insp = inspect(bind)
    if "ltc_residents" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("ltc_residents")]
        if "floor" in cols:
            try: op.drop_index("ix_ltc_residents_floor", table_name="ltc_residents")
            except Exception: pass
            op.drop_column("ltc_residents", "floor")
