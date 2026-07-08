"""add expense_requests + expense_attachments (지출결의)

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'q0r1s2t3u4v5'
down_revision = 'p9q0r1s2t3u4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names()

    if "expense_requests" not in tables:
        op.create_table(
            "expense_requests",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("vendor", sa.String(length=200), nullable=True),
            sa.Column("category", sa.String(length=50), nullable=False, server_default="기타"),
            sa.Column("payment_method", sa.String(length=50), nullable=True),
            sa.Column("purchased_at", sa.String(length=20), nullable=True),
            sa.Column("memo", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("reject_reason", sa.Text(), nullable=True),
            sa.Column("requester_id", sa.String(), nullable=True),
            sa.Column("requester_name", sa.String(length=100), nullable=True),
            sa.Column("approver_id", sa.String(), nullable=True),
            sa.Column("approver_name", sa.String(length=100), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_expense_requests_category", "expense_requests", ["category"])
        op.create_index("ix_expense_requests_status", "expense_requests", ["status"])
        op.create_index("ix_expense_requests_requester_id", "expense_requests", ["requester_id"])
        op.create_index("ix_expense_requests_created_at", "expense_requests", ["created_at"])

    if "expense_attachments" not in tables:
        op.create_table(
            "expense_attachments",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("request_id", sa.String(), sa.ForeignKey("expense_requests.id", ondelete="CASCADE"), nullable=False),
            sa.Column("file_name", sa.String(length=300), nullable=False),
            sa.Column("file_url", sa.String(length=500), nullable=False),
            sa.Column("content_type", sa.String(length=100), nullable=True),
            sa.Column("file_size", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_expense_attachments_request_id", "expense_attachments", ["request_id"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names()
    if "expense_attachments" in tables:
        op.drop_table("expense_attachments")
    if "expense_requests" in tables:
        op.drop_table("expense_requests")
