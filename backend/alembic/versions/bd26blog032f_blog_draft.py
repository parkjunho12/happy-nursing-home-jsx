"""블로그 초안 — 사진 사용 판단 · 초안 · 발행 이력.

네이버는 공식 글쓰기 API 가 없어 발행은 사람이 붙여넣는다. 그래서 이 표들은
'초안을 잘 만들어 보여주는 것'까지만 책임진다.

사진 표를 따로 두는 이유: 보호자 앨범에 올라간 것은 '보호자가 볼 수 있다'는
뜻이지 '공개 홍보에 써도 된다'는 뜻이 아니다. 시스템 어디에도 그 구분이
없어 새로 둔다. 확인하지 않은 사진은 자동 후보에 오르지 않는다.

Revision ID: bd26blog032f
Revises: pl26two039n
"""
from alembic import op
import sqlalchemy as sa


revision = "bd26blog032f"
down_revision = "pl26two039n"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_photo_uses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("origin_url", sa.String(length=500), nullable=False),
        sa.Column("origin_sha256", sa.String(length=64), nullable=True),
        sa.Column("publicity", sa.String(length=10), nullable=False, server_default="unknown"),
        sa.Column("publicity_by", sa.String(length=100), nullable=True),
        sa.Column("publicity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("publicity_note", sa.String(length=200), nullable=True),
        sa.Column("mask_status", sa.String(length=10), nullable=False, server_default="none"),
        sa.Column("mask_url", sa.String(length=500), nullable=True),
        sa.Column("mask_boxes", sa.JSON(), nullable=True),
        sa.Column("mask_detector", sa.String(length=30), nullable=True),
        sa.Column("mask_reason", sa.String(length=200), nullable=True),
        sa.Column("mask_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mask_reviewed_by", sa.String(length=100), nullable=True),
        sa.Column("mask_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sensitive", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("taken_on", sa.String(length=10), nullable=True),
        sa.Column("program_title", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("source", "source_id", name="uq_blog_photo_source"),
    )
    op.create_index("ix_blog_photo_state", "blog_photo_uses", ["publicity", "mask_status"])
    op.create_index("ix_blog_photo_uses_origin_sha256", "blog_photo_uses", ["origin_sha256"])

    op.create_table(
        "blog_drafts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("run_key", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("title_alts", sa.JSON(), nullable=True),
        sa.Column("blocks", sa.JSON(), nullable=True),
        sa.Column("hashtags", sa.JSON(), nullable=True),
        sa.Column("topic", sa.String(length=60), nullable=True),
        sa.Column("activity_dates", sa.JSON(), nullable=True),
        sa.Column("source_note", sa.Text(), nullable=True),
        sa.Column("dup_status", sa.String(length=24), nullable=False, server_default="unknown"),
        sa.Column("dup_report", sa.JSON(), nullable=True),
        sa.Column("model", sa.String(length=40), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("cached_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("reasoning_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_usd", sa.Float(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hold_reason", sa.String(length=300), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("approved_by", sa.String(length=100), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("content_rev", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # 같은 예약 회차가 두 번 돌아 초안이 둘 생기는 것을 표에서 막는다
        sa.UniqueConstraint("run_key", name="uq_blog_draft_run"),
    )
    op.create_index("ix_blog_draft_state", "blog_drafts", ["status", "created_at"])
    op.create_index("ix_blog_drafts_created_at", "blog_drafts", ["created_at"])

    op.create_table(
        "blog_histories",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("log_no", sa.String(length=40), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("published_on", sa.String(length=10), nullable=True),
        sa.Column("activity_on", sa.String(length=10), nullable=True),
        sa.Column("topic", sa.String(length=60), nullable=True),
        sa.Column("program_name", sa.String(length=200), nullable=True),
        sa.Column("highlights", sa.JSON(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("photo_refs", sa.JSON(), nullable=True),
        sa.Column("collected_by", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("log_no", name="uq_blog_history_logno"),
    )
    op.create_index("ix_blog_history_date", "blog_histories", ["published_on"])


def downgrade() -> None:
    op.drop_table("blog_histories")
    op.drop_table("blog_drafts")
    op.drop_table("blog_photo_uses")
