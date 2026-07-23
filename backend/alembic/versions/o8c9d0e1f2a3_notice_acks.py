"""공지 읽음 확인

Revision ID: o8c9d0e1f2a3
Revises: n7b8c9d0e1f2
"""
import sqlalchemy as sa
from alembic import op

revision = "o8c9d0e1f2a3"
down_revision = "n7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "notice_acks" in insp.get_table_names():
        return
    op.create_table(
        "notice_acks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("notice_id", sa.String(), nullable=False, index=True),
        sa.Column("user_id", sa.String(), nullable=False, index=True),
        sa.Column("user_name", sa.String(100), nullable=True),
        sa.Column("position", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("notice_acks")
