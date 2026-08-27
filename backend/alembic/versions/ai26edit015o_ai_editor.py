"""AI 페이지 편집기 — 서비스 레지스트리 · 작업 큐 · 에이전트 · 진행 기록

Revision ID: ai26edit015o
Revises: pg26day014n
"""
from alembic import op
import sqlalchemy as sa

revision = "ai26edit015o"
down_revision = "pg26day014n"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_edit_services",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("key", sa.String(40), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("repo", sa.String(200), nullable=False),
        sa.Column("root_path", sa.String(200), nullable=False, server_default="apps/admin"),
        sa.Column("base_branch", sa.String(100), nullable=False, server_default="develop"),
        sa.Column("install_cmd", sa.String(300), nullable=True),
        sa.Column("dev_cmd", sa.String(300), nullable=True),
        sa.Column("check_cmds", sa.JSON(), nullable=True),
        sa.Column("pages", sa.JSON(), nullable=True),
        sa.Column("prod_url", sa.String(300), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint("uq_ai_edit_services_key", "ai_edit_services", ["key"])

    op.create_table(
        "ai_edit_agents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("agent_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(100), nullable=False, server_default="편집 에이전트"),
        sa.Column("token_hash", sa.String(64), nullable=True),
        sa.Column("hostname", sa.String(120), nullable=True),
        sa.Column("version", sa.String(30), nullable=True),
        sa.Column("tools", sa.JSON(), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("now_job_id", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint("uq_ai_edit_agents_agent_id", "ai_edit_agents", ["agent_id"])
    op.create_index("ix_ai_edit_agents_token_hash", "ai_edit_agents", ["token_hash"])
    op.create_index("ix_ai_edit_agents_last_seen", "ai_edit_agents", ["last_seen"])

    op.create_table(
        "ai_edit_jobs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("service_key", sa.String(40), nullable=False),
        sa.Column("page_url", sa.String(300), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False, server_default="element"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("approve_mode", sa.String(10), nullable=False, server_default="manual"),
        sa.Column("extra_notes", sa.Text(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),
        sa.Column("target", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(12), nullable=False, server_default="QUEUED"),
        sa.Column("step", sa.String(120), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("branch", sa.String(160), nullable=True),
        sa.Column("base_sha", sa.String(40), nullable=True),
        sa.Column("head_sha", sa.String(40), nullable=True),
        sa.Column("worktree", sa.String(400), nullable=True),
        sa.Column("plan", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("diff", sa.Text(), nullable=True),
        sa.Column("files", sa.JSON(), nullable=True),
        sa.Column("checks", sa.JSON(), nullable=True),
        sa.Column("preview_url", sa.String(300), nullable=True),
        sa.Column("pr_url", sa.String(300), nullable=True),
        sa.Column("pr_number", sa.Integer(), nullable=True),
        sa.Column("deploy_run", sa.String(300), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("agent_id", sa.String(64), nullable=True),
        sa.Column("requested_by", sa.String(100), nullable=True),
        sa.Column("requested_by_id", sa.String(), nullable=True),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    for col in ("service_key", "status", "agent_id", "requested_by_id", "created_at"):
        op.create_index(f"ix_ai_edit_jobs_{col}", "ai_edit_jobs", [col])
    # 큐에서 다음 작업을 뽑을 때 쓰는 순서
    op.create_index("ix_ai_edit_jobs_status_created", "ai_edit_jobs", ["status", "created_at"])

    op.create_table(
        "ai_edit_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("level", sa.String(10), nullable=False, server_default="info"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_ai_edit_events_job_id", "ai_edit_events", ["job_id"])
    op.create_index("ix_ai_edit_events_job_at", "ai_edit_events", ["job_id", "created_at"])


def downgrade() -> None:
    op.drop_table("ai_edit_events")
    op.drop_table("ai_edit_jobs")
    op.drop_table("ai_edit_agents")
    op.drop_table("ai_edit_services")
