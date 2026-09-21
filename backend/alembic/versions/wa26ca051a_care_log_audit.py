"""주간 급여제공 기록지 점검 (care_log_audits)

Revision ID: wa26ca051a
Revises: fc26calc051a
"""
from alembic import op
import sqlalchemy as sa

revision = "wa26ca051a"
down_revision = "fc26calc051a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "care_log_audits",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("week_end", sa.String(length=10), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=500), nullable=True),
        sa.Column("coverage", sa.JSON(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("findings", sa.JSON(), nullable=True),
        sa.Column("staff_workload", sa.JSON(), nullable=True),
        sa.Column("uploaded_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("week_start", name="uq_care_log_audits_week_start"),
    )
    op.create_index("ix_care_log_audits_week_start", "care_log_audits", ["week_start"])


def downgrade() -> None:
    op.drop_index("ix_care_log_audits_week_start", table_name="care_log_audits")
    op.drop_table("care_log_audits")
