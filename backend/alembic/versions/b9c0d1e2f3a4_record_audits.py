"""record_audits table — 제공기록지 검수 이력 DB 저장

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'b9c0d1e2f3a4'
down_revision = 'a8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "record_audits" not in insp.get_table_names():
        op.create_table(
            "record_audits",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("filename", sa.String(length=300), nullable=True),
            sa.Column("auditor", sa.String(length=100), nullable=True),
            sa.Column("result", sa.JSON(), nullable=True),
            sa.Column("context", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_record_audits_created_at", "record_audits", ["created_at"])


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "record_audits" in insp.get_table_names():
        try:
            op.drop_index("ix_record_audits_created_at", table_name="record_audits")
        except Exception:
            pass
        op.drop_table("record_audits")
