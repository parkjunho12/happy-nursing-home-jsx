"""담당 어르신 배정 + 호실

Revision ID: v5d6e7f8a9b0
Revises: u4c5d6e7f8a9
"""
import sqlalchemy as sa
from alembic import op

revision = "v5d6e7f8a9b0"
down_revision = "u4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("ltc_residents")}
    if "room" not in cols:
        op.add_column("ltc_residents", sa.Column("room", sa.String(10), nullable=True))
    tables = insp.get_table_names()
    if "resident_assignments" not in tables:
        op.create_table(
            "resident_assignments",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("resident_id", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("care_staff_id", sa.String(), nullable=True, index=True),
            sa.Column("care_staff_name", sa.String(50), nullable=True),
            sa.Column("rehab_staff_id", sa.String(), nullable=True, index=True),
            sa.Column("rehab_staff_name", sa.String(50), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "resident_assignment_logs" not in tables:
        op.create_table(
            "resident_assignment_logs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("resident_id", sa.String(), nullable=False, index=True),
            sa.Column("resident_name", sa.String(50), nullable=True),
            sa.Column("field", sa.String(20), nullable=False),
            sa.Column("before", sa.String(100), nullable=True),
            sa.Column("after", sa.String(100), nullable=True),
            sa.Column("changed_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, index=True),
        )


def downgrade() -> None:
    op.drop_table("resident_assignment_logs")
    op.drop_table("resident_assignments")
    op.drop_column("ltc_residents", "room")
