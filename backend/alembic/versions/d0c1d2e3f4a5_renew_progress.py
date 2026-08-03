"""인정서 갱신 신청 진행 상태

Revision ID: d0c1d2e3f4a5
Revises: c9b0c1d2e3f4
"""
import sqlalchemy as sa
from alembic import op

revision = "d0c1d2e3f4a5"
down_revision = "c9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("resident_doc_status")}
    for name in ("renew_applied_at", "renew_base_end"):
        if name not in cols:
            op.add_column("resident_doc_status", sa.Column(name, sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("resident_doc_status", "renew_applied_at")
    op.drop_column("resident_doc_status", "renew_base_end")
