"""add blog_ai_logs table

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa

revision = "p2q3r4s5t6u7"
down_revision = "o1p2q3r4s5t6"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(name)


def upgrade():
    if _has_table("blog_ai_logs"):
        return
    op.create_table(
        "blog_ai_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=True, index=True),
        sa.Column("user_name", sa.String(), nullable=True),
        sa.Column("user_role", sa.String(), nullable=True),
        sa.Column("position", sa.String(), nullable=True),
        sa.Column("title_keyword", sa.String(), nullable=True),
        sa.Column("program_name", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("activity_date", sa.String(), nullable=True),
        sa.Column("participant_count", sa.String(), nullable=True),
        sa.Column("tone", sa.String(), nullable=True),
        sa.Column("photo_count", sa.Integer(), server_default="0"),
        sa.Column("titles", sa.JSON(), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("hashtags", sa.JSON(), nullable=True),
        sa.Column("guardian_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_blog_ai_logs_created_at", "blog_ai_logs", ["created_at"])


def downgrade():
    if _has_table("blog_ai_logs"):
        op.drop_table("blog_ai_logs")
