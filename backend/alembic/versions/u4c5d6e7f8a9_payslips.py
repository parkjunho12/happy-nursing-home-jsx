"""급여명세서 확인·서명

Revision ID: u4c5d6e7f8a9
Revises: t3b4c5d6e7f8
"""
import sqlalchemy as sa
from alembic import op

revision = "u4c5d6e7f8a9"
down_revision = "t3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if "payslips" in insp.get_table_names():
        return
    op.create_table(
        "payslips",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("staff_id", sa.String(), nullable=False, index=True),
        sa.Column("staff_name", sa.String(50), nullable=True),
        sa.Column("year_month", sa.String(7), nullable=False, index=True),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("uploaded_by", sa.String(100), nullable=True),
        sa.Column("signature_url", sa.Text(), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("payslips")
