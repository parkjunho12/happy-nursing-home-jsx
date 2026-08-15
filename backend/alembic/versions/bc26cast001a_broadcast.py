"""broadcast (안내방송) tables

Revision ID: bc26cast001a
Revises: ar26mon0001a
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "bc26cast001a"
down_revision = "ar26mon0001a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()

    if "broadcast_devices" not in tables:
        op.create_table(
            "broadcast_devices",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("device_id", sa.String(64), nullable=False),
            sa.Column("facility_id", sa.String(64), nullable=False, server_default="default"),
            sa.Column("name", sa.String(100), nullable=False, server_default="방송 PC"),
            sa.Column("token_hash", sa.String(64), nullable=True),
            sa.Column("zones", sa.JSON(), nullable=True),
            sa.Column("output_name", sa.String(200), nullable=True),
            sa.Column("version", sa.String(30), nullable=True),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_ip", sa.String(64), nullable=True),
            sa.Column("now_playing", sa.String(), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("device_id", name="uq_broadcast_device_id"),
        )
        op.create_index("ix_broadcast_devices_device_id", "broadcast_devices", ["device_id"])
        op.create_index("ix_broadcast_devices_token_hash", "broadcast_devices", ["token_hash"])
        op.create_index("ix_broadcast_devices_last_seen", "broadcast_devices", ["last_seen"])
        op.create_index("ix_broadcast_devices_facility_id", "broadcast_devices", ["facility_id"])

    if "broadcast_media" not in tables:
        op.create_table(
            "broadcast_media",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("kind", sa.String(10), nullable=False, server_default="AUDIO"),
            sa.Column("filename", sa.String(255), nullable=False),
            sa.Column("url", sa.String(500), nullable=False),
            sa.Column("mime", sa.String(100), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("duration_sec", sa.Integer(), nullable=True),
            sa.Column("sha256", sa.String(64), nullable=True),
            sa.Column("text_hash", sa.String(64), nullable=True),
            sa.Column("tts_provider", sa.String(40), nullable=True),
            sa.Column("tts_voice", sa.String(40), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_broadcast_media_sha256", "broadcast_media", ["sha256"])
        op.create_index("ix_broadcast_media_text_hash", "broadcast_media", ["text_hash"])

    if "broadcast_schedules" not in tables:
        op.create_table(
            "broadcast_schedules",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("type", sa.String(10), nullable=False, server_default="TTS"),
            sa.Column("text", sa.Text(), nullable=True),
            sa.Column("media_id", sa.String(), nullable=True),
            sa.Column("media_url", sa.String(500), nullable=True),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("timezone", sa.String(40), nullable=False, server_default="Asia/Seoul"),
            sa.Column("repeat_rule", sa.JSON(), nullable=True),
            sa.Column("zones", sa.JSON(), nullable=True),
            sa.Column("volume", sa.Integer(), nullable=False, server_default="70"),
            sa.Column("status", sa.String(10), nullable=False, server_default="DRAFT"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("max_seconds", sa.Integer(), nullable=False, server_default="600"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("created_by_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_broadcast_schedules_scheduled_at", "broadcast_schedules", ["scheduled_at"])
        op.create_index("ix_broadcast_schedules_media_id", "broadcast_schedules", ["media_id"])
        op.create_index("ix_broadcast_schedules_created_by_id", "broadcast_schedules", ["created_by_id"])

    if "broadcast_runs" not in tables:
        op.create_table(
            "broadcast_runs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("schedule_id", sa.String(), nullable=False),
            sa.Column("occurrence_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("device_id", sa.String(64), nullable=True),
            sa.Column("status", sa.String(10), nullable=False, server_default="PENDING"),
            sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            # 중복 재생을 막는 핵심 제약 — 한 회차는 한 번만
            sa.UniqueConstraint("schedule_id", "occurrence_at", name="uq_broadcast_run_occurrence"),
        )
        op.create_index("ix_broadcast_runs_schedule_id", "broadcast_runs", ["schedule_id"])
        op.create_index("ix_broadcast_runs_device_id", "broadcast_runs", ["device_id"])
        op.create_index("ix_broadcast_runs_occ", "broadcast_runs", ["occurrence_at"])

    if "broadcast_logs" not in tables:
        op.create_table(
            "broadcast_logs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("schedule_id", sa.String(), nullable=True),
            sa.Column("run_id", sa.String(), nullable=True),
            sa.Column("device_id", sa.String(64), nullable=True),
            sa.Column("event", sa.String(30), nullable=False, server_default="PLAY"),
            sa.Column("status", sa.String(10), nullable=True),
            sa.Column("title", sa.String(200), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("actor", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_broadcast_logs_schedule_id", "broadcast_logs", ["schedule_id"])
        op.create_index("ix_broadcast_logs_run_id", "broadcast_logs", ["run_id"])
        op.create_index("ix_broadcast_logs_device_id", "broadcast_logs", ["device_id"])
        op.create_index("ix_broadcast_logs_created_at", "broadcast_logs", ["created_at"])

    if "broadcast_commands" not in tables:
        op.create_table(
            "broadcast_commands",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("device_id", sa.String(64), nullable=True),
            sa.Column("command", sa.String(30), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("issued_by", sa.String(100), nullable=True),
            sa.Column("acked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_broadcast_commands_device_id", "broadcast_commands", ["device_id"])
        op.create_index("ix_broadcast_commands_created_at", "broadcast_commands", ["created_at"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()
    for t in ("broadcast_commands", "broadcast_logs", "broadcast_runs",
              "broadcast_schedules", "broadcast_media", "broadcast_devices"):
        if t in tables:
            op.drop_table(t)
