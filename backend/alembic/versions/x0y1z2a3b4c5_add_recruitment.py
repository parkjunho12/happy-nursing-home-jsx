"""add recruitment_posts & recruitment_applications (+ seed 4 posts)

Revision ID: x0y1z2a3b4c5
Revises: w9x0y1z2a3b4
Create Date: 2026-06-25
"""
import uuid
from datetime import datetime, timezone, timedelta
from alembic import op
import sqlalchemy as sa

revision = "x0y1z2a3b4c5"
down_revision = "w9x0y1z2a3b4"
branch_labels = None
depends_on = None

KST = timezone(timedelta(hours=9))


def _insp():
    return sa.inspect(op.get_bind())


def upgrade():
    insp = _insp()

    if not insp.has_table("recruitment_posts"):
        op.create_table(
            "recruitment_posts",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("category", sa.String(), nullable=True),
            sa.Column("employment_type", sa.String(), nullable=True),
            sa.Column("work_time", sa.String(), nullable=True),
            sa.Column("salary", sa.String(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="모집중"),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not insp.has_table("recruitment_applications"):
        op.create_table(
            "recruitment_applications",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("recruitment_post_id", sa.String(), nullable=True),
            sa.Column("category", sa.String(), nullable=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("birth", sa.String(), nullable=True),
            sa.Column("phone", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("experience", sa.Text(), nullable=True),
            sa.Column("introduction", sa.Text(), nullable=True),
            sa.Column("resume_file", sa.String(), nullable=True),
            sa.Column("privacy_agreed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("status", sa.String(), nullable=False, server_default="접수"),
            sa.Column("admin_memo", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_recruitment_applications_status", "recruitment_applications", ["status"])
        op.create_index("ix_recruitment_applications_created_at", "recruitment_applications", ["created_at"])

    # ── 시드: 예시 공고 4종 (비공개 상태로 등록 → 관리자가 검토 후 공개) ──
    posts = sa.table(
        "recruitment_posts",
        sa.column("id", sa.String),
        sa.column("title", sa.String),
        sa.column("category", sa.String),
        sa.column("employment_type", sa.String),
        sa.column("work_time", sa.String),
        sa.column("salary", sa.String),
        sa.column("description", sa.Text),
        sa.column("status", sa.String),
        sa.column("is_public", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT COUNT(*) FROM recruitment_posts")).scalar()
    if not existing:
        now = datetime.now(KST)
        seed = [
            ("요양보호사", "요양보호사", "정규직", "주간 09:00~18:00 (교대 협의 가능)", "면접 후 협의",
             "어르신을 진심으로 돌볼 따뜻한 요양보호사를 모십니다. 자격증 소지자 우대하며, 경력에 따라 처우를 협의합니다."),
            ("사회복지사", "사회복지사", "정규직", "평일 09:00~18:00", "면접 후 협의",
             "어르신 상담·프로그램 기획·기록 관리를 담당할 사회복지사를 모십니다. 사회복지사 2급 이상."),
            ("간호조무사", "간호조무사", "정규직/시간제", "협의 (주간/교대)", "면접 후 협의",
             "어르신 건강관리와 투약·바이탈 체크를 담당할 간호조무사를 모십니다. 관련 자격 소지자."),
            ("시설장", "시설장", "정규직", "평일 09:00~18:00", "면접 후 협의",
             "시설 운영 전반을 총괄할 시설장을 모십니다. 노인복지시설 운영 경력자 우대."),
        ]
        rows = []
        for i, (title, cat, emp, wt, sal, desc) in enumerate(seed):
            rows.append({
                "id": str(uuid.uuid4()),
                "title": title, "category": cat, "employment_type": emp,
                "work_time": wt, "salary": sal, "description": desc,
                "status": "모집중", "is_public": False, "sort_order": i,
                "created_at": now, "updated_at": now,
            })
        op.bulk_insert(posts, rows)


def downgrade():
    insp = _insp()
    if insp.has_table("recruitment_applications"):
        op.drop_table("recruitment_applications")
    if insp.has_table("recruitment_posts"):
        op.drop_table("recruitment_posts")
