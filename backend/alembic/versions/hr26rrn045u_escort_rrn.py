"""병원동행 요청에 주민등록번호 — 업체가 병원 접수를 대신할 때만 적는다.

Revision ID: hr26rrn045u
Revises: bp26pub044t
"""
from alembic import op
import sqlalchemy as sa

revision = "hr26rrn045u"
down_revision = "bp26pub044t"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hospital_escorts", sa.Column("resident_rrn", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("hospital_escorts", "resident_rrn")
