"""보호자 면회 예약

Revision ID: n7b8c9d0e1f2
Revises: m6a7b8c9d0e1
"""
import sqlalchemy as sa
from alembic import op

revision = "n7b8c9d0e1f2"
down_revision = "m6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "visit_reservations" in insp.get_table_names():
        return
    op.create_table(
        "visit_reservations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("guardian_id", sa.String(), nullable=False, index=True),
        sa.Column("guardian_name", sa.String(50), nullable=True),
        sa.Column("resident_id", sa.String(), nullable=False, index=True),
        sa.Column("resident_name", sa.String(50), nullable=True),
        sa.Column("relation", sa.String(20), nullable=True),
        sa.Column("date", sa.String(10), nullable=False, index=True),
        sa.Column("time", sa.String(5), nullable=False),
        sa.Column("visitors", sa.Integer(), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True, index=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("decided_by", sa.String(100), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("schedule_event_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("visit_reservations")
