"""지도점검 종합 체크리스트

Revision ID: b4a5b6c7d8e9
Revises: a3f4a5b6c7d8
"""
import sqlalchemy as sa
from alembic import op

revision = "b4a5b6c7d8e9"
down_revision = "a3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    names = insp.get_table_names()
    if "audit_rounds" not in names:
        op.create_table(
            "audit_rounds",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("date", sa.String(10), nullable=False, index=True),
            sa.Column("title", sa.String(100), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "audit_items" not in names:
        op.create_table(
            "audit_items",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("round_id", sa.String(), nullable=False, index=True),
            sa.Column("section", sa.String(50), nullable=False),
            sa.Column("sub", sa.String(100), nullable=True),
            sa.Column("title", sa.String(300), nullable=False),
            sa.Column("order", sa.Integer(), nullable=True),
            sa.Column("assignee_name", sa.String(100), nullable=True),
            sa.Column("checked", sa.Boolean(), nullable=True),
            sa.Column("checked_by", sa.String(100), nullable=True),
            sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("audit_items")
    op.drop_table("audit_rounds")
