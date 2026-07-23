"""낙상·사고 보고서

Revision ID: p9d0e1f2a3b4
Revises: o8c9d0e1f2a3
"""
import sqlalchemy as sa
from alembic import op

revision = "p9d0e1f2a3b4"
down_revision = "o8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "incident_reports" in insp.get_table_names():
        return
    op.create_table(
        "incident_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("resident_id", sa.String(), nullable=True, index=True),
        sa.Column("resident_name", sa.String(50), nullable=True),
        sa.Column("type", sa.String(20), nullable=False, index=True),
        sa.Column("severity", sa.String(10), nullable=True),
        sa.Column("occurred_date", sa.String(10), nullable=False, index=True),
        sa.Column("occurred_time", sa.String(5), nullable=True),
        sa.Column("location", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=True),
        sa.Column("follow_up", sa.Text(), nullable=True),
        sa.Column("guardian_notified", sa.Boolean(), nullable=True),
        sa.Column("guardian_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("guardian_method", sa.String(20), nullable=True),
        sa.Column("guardian_note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True, index=True),
        sa.Column("source", sa.String(20), nullable=True),
        sa.Column("handover_ref", sa.String(120), nullable=True, unique=True),
        sa.Column("reporter_name", sa.String(100), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("incident_reports")
