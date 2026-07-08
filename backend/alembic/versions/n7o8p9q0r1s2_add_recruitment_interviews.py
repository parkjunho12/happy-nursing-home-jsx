"""add recruitment_interviews (+ merge 3 heads)

Revision ID: n7o8p9q0r1s2
Revises: f8a9b0c1d2e3, dd5268ecd651, k1l2m3n4o5p6
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "n7o8p9q0r1s2"
down_revision = ("f8a9b0c1d2e3", "dd5268ecd651", "k1l2m3n4o5p6")
branch_labels = None
depends_on = None


def upgrade():
    insp = sa.inspect(op.get_bind())
    if insp.has_table("recruitment_interviews"):
        return
    op.create_table(
        "recruitment_interviews",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("application_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("interview_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("result", sa.String(), nullable=True),
        sa.Column("notified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_recruitment_interviews_interview_at", "recruitment_interviews", ["interview_at"])
    op.create_index("ix_recruitment_interviews_status", "recruitment_interviews", ["status"])


def downgrade():
    insp = sa.inspect(op.get_bind())
    if insp.has_table("recruitment_interviews"):
        op.drop_table("recruitment_interviews")
