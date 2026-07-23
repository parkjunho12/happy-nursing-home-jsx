"""휴무 신청 확장 — 희망휴무 연차 반영 플래그, 맞교대 근무 코드

Revision ID: m6a7b8c9d0e1
Revises: k4e5f6a7b8c9
"""
import sqlalchemy as sa
from alembic import op

revision = "m6a7b8c9d0e1"
down_revision = "k4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    lr = {c["name"] for c in insp.get_columns("leave_requests")}
    if "use_annual" not in lr:
        op.add_column("leave_requests", sa.Column("use_annual", sa.Boolean(), nullable=True))
    sr = {c["name"] for c in insp.get_columns("swap_requests")}
    if "shift_code" not in sr:
        op.add_column("swap_requests", sa.Column("shift_code", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("swap_requests", "shift_code")
    op.drop_column("leave_requests", "use_annual")
