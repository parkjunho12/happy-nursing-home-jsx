"""직원 서류: CCTV·퇴직연금 추가, 대체휴일+보상휴가 통합

Revision ID: a7d8e9f0a1b2
Revises: f6c7d8e9f0a1
"""
import sqlalchemy as sa
from alembic import op

revision = "a7d8e9f0a1b2"
down_revision = "f6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("staff_hr_records")}
    for name in ("doc_cctv", "doc_pension"):
        if name not in cols:
            op.add_column("staff_hr_records", sa.Column(name, sa.Boolean(), nullable=True))
    # 근로자 대표(구 대체휴일) 값이 비어 있으면 보상휴가 값으로 승계
    op.execute(
        "UPDATE staff_hr_records SET doc_subholiday = doc_compleave "
        "WHERE doc_subholiday IS NULL AND doc_compleave IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("staff_hr_records", "doc_cctv")
    op.drop_column("staff_hr_records", "doc_pension")
