"""add volunteer_applications table

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "u7v8w9x0y1z2"
down_revision = "t6u7v8w9x0y1"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade():
    if not _has_table("volunteer_applications"):
        op.create_table(
            "volunteer_applications",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("phone", sa.String(), nullable=False),
            sa.Column("birth_or_age", sa.String(), nullable=True),
            sa.Column("preferred_activity", sa.String(), nullable=True),
            sa.Column("preferred_day", sa.String(), nullable=True),
            sa.Column("preferred_time", sa.String(), nullable=True),
            sa.Column("experience", sa.Text(), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("privacy_agreed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("status", sa.String(), nullable=False, server_default="대기"),
            sa.Column("admin_memo", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_volunteer_applications_status", "volunteer_applications", ["status"])


def downgrade():
    if _has_table("volunteer_applications"):
        op.drop_table("volunteer_applications")
