"""AI 페이지 편집기 — '운영 반영' 을 위한 자리.

편집기의 기준 브랜치는 develop 이고, 배포 워크플로는 main 에서만 돈다.
그래서 AI 수정을 승인·병합해도 운영에는 아무것도 반영되지 않았다.
화면에서 한 번 더 올릴 수 있게 한다.

  ai_edit_services.deploy_branch — 배포 워크플로가 보는 브랜치
  ai_edit_jobs.kind              — edit(코드 수정) | promote(운영 반영)
  ai_edit_agents.pending_deploy  — 아직 운영에 안 올라간 커밋들

kind 를 따로 두는 이유: 운영 반영도 큐·진행표시·기록이 필요하다.
표를 새로 만드는 대신 같은 표에 담아 그 장치를 그대로 쓴다.

Revision ID: ai26edit017q
Revises: ai26edit016p
"""
from alembic import op
import sqlalchemy as sa


revision = "ai26edit017q"
down_revision = "ai26edit016p"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_edit_services",
                  sa.Column("deploy_branch", sa.String(length=100), nullable=True))
    # 이미 등록된 서비스는 이 저장소의 실제 배포 브랜치로 채워 둔다.
    # 비워두면 '운영 반영' 버튼이 아예 안 보여서, 왜 없는지 찾게 된다.
    op.execute("UPDATE ai_edit_services SET deploy_branch = 'main' "
               "WHERE deploy_branch IS NULL")

    # 기존 작업은 전부 코드 수정이었다
    op.add_column("ai_edit_jobs",
                  sa.Column("kind", sa.String(length=12), nullable=False,
                            server_default="edit"))
    op.create_index("ix_ai_edit_jobs_kind", "ai_edit_jobs", ["kind"])

    op.add_column("ai_edit_agents", sa.Column("pending_deploy", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_edit_agents", "pending_deploy")
    op.drop_index("ix_ai_edit_jobs_kind", table_name="ai_edit_jobs")
    op.drop_column("ai_edit_jobs", "kind")
    op.drop_column("ai_edit_services", "deploy_branch")
