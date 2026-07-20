"""근무표 저장 이력(work_schedule_versions)

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
"""
from alembic import op
import sqlalchemy as sa

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None

TABLE = "work_schedule_versions"


def upgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("year_month", sa.String(length=7), nullable=False, index=True),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("rows", sa.JSON(), nullable=True),
        sa.Column("base_hours", sa.String(length=10), nullable=True),
        sa.Column("base_days", sa.String(length=10), nullable=True),
        sa.Column("as_of", sa.String(length=20), nullable=True),
        sa.Column("team_offsets", sa.JSON(), nullable=True),
        sa.Column("cells", sa.Integer(), nullable=True),
        sa.Column("changed", sa.Integer(), nullable=True),
        sa.Column("saved_by", sa.String(length=100), nullable=True),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=True, index=True),
    )


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)
