"""입소 상담 — 방문 상담 권유와 예정일.

전화만으로는 정하기 어렵다. 한번 오셔서 방과 식사를 보시면 그때 정해지는
일이 많아, 권유했는지와 날짜가 잡혔는지를 남긴다.

Revision ID: cv26vs050z
Revises: cp26cu049y
"""
from alembic import op
import sqlalchemy as sa

revision = "cv26vs050z"
down_revision = "cp26cu049y"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("consults", sa.Column("visit_plan", sa.String(length=30), nullable=True))
    op.add_column("consults", sa.Column("visit_date", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("consults", "visit_date")
    op.drop_column("consults", "visit_plan")
