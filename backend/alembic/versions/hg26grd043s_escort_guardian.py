"""병원동행 요청에 보호자 연락처 — 업체가 협의할 상대.

Revision ID: hg26grd043s
Revises: he26esc042r
"""
from alembic import op
import sqlalchemy as sa

revision = "hg26grd043s"
down_revision = "he26esc042r"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hospital_escorts", sa.Column("guardian_name", sa.String(length=50), nullable=True))
    op.add_column("hospital_escorts", sa.Column("guardian_relation", sa.String(length=20), nullable=True))
    op.add_column("hospital_escorts", sa.Column("guardian_phone", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("hospital_escorts", "guardian_phone")
    op.drop_column("hospital_escorts", "guardian_relation")
    op.drop_column("hospital_escorts", "guardian_name")
