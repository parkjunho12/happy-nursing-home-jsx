"""병원동행 요청 — 간호팀 → 복지팀 → 업체.

Revision ID: he26esc042r
Revises: dt26diet041q
"""
from alembic import op
import sqlalchemy as sa

revision = "he26esc042r"
down_revision = "dt26diet041q"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hospital_escorts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("resident_id", sa.String(), nullable=True),
        sa.Column("resident_name", sa.String(length=100), nullable=False),
        sa.Column("floor", sa.String(length=20), nullable=True),
        sa.Column("room", sa.String(length=10), nullable=True),
        sa.Column("walking", sa.String(length=10), nullable=True),
        sa.Column("hemiplegia", sa.String(length=10), nullable=True),
        sa.Column("wheelchair", sa.String(length=10), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("hospital", sa.String(length=120), nullable=False),
        sa.Column("department", sa.String(length=60), nullable=True),
        sa.Column("visit_date", sa.String(length=10), nullable=False),
        sa.Column("visit_time", sa.String(length=5), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="draft"),
        sa.Column("shared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shared_by", sa.String(length=100), nullable=True),
        sa.Column("vendor", sa.String(length=120), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_by", sa.String(length=100), nullable=True),
        sa.Column("transport", sa.String(length=120), nullable=True),
        sa.Column("transport_note", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by", sa.String(length=100), nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("done_by", sa.String(length=100), nullable=True),
        sa.Column("cancel_reason", sa.String(length=200), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_hospital_escorts_resident_id", "hospital_escorts", ["resident_id"])
    op.create_index("ix_hospital_escorts_status", "hospital_escorts", ["status"])
    op.create_index("ix_hospital_escorts_created_at", "hospital_escorts", ["created_at"])
    # 목록은 늘 '다가오는 진료일' 순으로 본다
    op.create_index("ix_escort_visit", "hospital_escorts", ["visit_date", "status"])

    op.create_table(
        "hospital_escort_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("escort_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("actor", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_hospital_escort_logs_escort_id", "hospital_escort_logs", ["escort_id"])
    op.create_index("ix_hospital_escort_logs_created_at", "hospital_escort_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("hospital_escort_logs")
    op.drop_index("ix_escort_visit", table_name="hospital_escorts")
    op.drop_table("hospital_escorts")
