"""회의 준비 문서

Revision ID: hg27meetprep1
Revises: hg26grd043s
"""
import sqlalchemy as sa
from alembic import op

revision = "hg27meetprep1"
down_revision = "hg26grd043s"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "meeting_preps" in insp.get_table_names():
        return
    op.create_table(
        "meeting_preps",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_name", sa.String(200), nullable=True),
        sa.Column("source_text", sa.Text(), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("author_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_table("meeting_preps")
