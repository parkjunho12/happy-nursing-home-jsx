"""operation pay item group + backfill

Revision ID: op26grp0001a
Revises: e4f5a6b7c8d0
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "op26grp0001a"
down_revision = "e4f5a6b7c8d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "operation_pay_items" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("operation_pay_items")]
    if "grp" not in cols:
        op.add_column("operation_pay_items", sa.Column("grp", sa.String(30), nullable=True))
        # 기존(이미 시드된) 데이터 백필 — 키워드 분류
        bind = op.get_bind()
        from app.services.operations_groups import infer_group
        rows = bind.execute(sa.text("SELECT id, category, section FROM operation_pay_items")).fetchall()
        for rid, cat, sec in rows:
            bind.execute(sa.text("UPDATE operation_pay_items SET grp = :g WHERE id = :i"),
                         {"g": infer_group(cat or "", sec or ""), "i": rid})


def downgrade() -> None:
    op.drop_column("operation_pay_items", "grp")
