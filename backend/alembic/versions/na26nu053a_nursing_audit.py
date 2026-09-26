"""간호기록 점검 (nursing_audits)

Revision ID: na26nu053a
Revises: wh26hl052a
"""
from alembic import op
import sqlalchemy as sa

revision = "na26nu053a"
down_revision = "wh26hl052a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nursing_audits",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("window_start", sa.String(length=10), nullable=False),
        sa.Column("window_end", sa.String(length=10), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=500), nullable=True),
        sa.Column("coverage", sa.JSON(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("findings", sa.JSON(), nullable=True),
        sa.Column("home_nursing", sa.JSON(), nullable=True),
        sa.Column("uploaded_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("month", name="uq_nursing_audits_month"),
    )
    op.create_index("ix_nursing_audits_month", "nursing_audits", ["month"])


def downgrade() -> None:
    op.drop_index("ix_nursing_audits_month", table_name="nursing_audits")
    op.drop_table("nursing_audits")
