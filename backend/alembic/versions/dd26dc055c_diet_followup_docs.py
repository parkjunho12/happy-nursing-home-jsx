"""식이 후속조치 — 서류현황 기록 항목 추가.

계획서를 고쳐 놓고 「어르신 서류현황」에 작성 일시를 안 적는 일이 잦다.
지도점검에서 보는 것은 그 일시라, 문서만 고치고 끝내면 안 한 것과 같다.

Revision ID: dd26dc055c
Revises: df26fu054b
"""
from alembic import op
import sqlalchemy as sa

revision = "dd26dc055c"
down_revision = "df26fu054b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("diet_followups", sa.Column("docs_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("diet_followups", sa.Column("docs_by", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("diet_followups", "docs_by")
    op.drop_column("diet_followups", "docs_at")
