"""블로그 초안 — Aside 로 네이버에 발행하는 데 필요한 칸.

지금까지는 '초안을 잘 만들어 보여주는 것' 까지였고, 붙여넣기는 사람이 했다.
이제 검토가 끝난 글은 Mac 에서 도는 발행기가 가져가 Aside 브라우저(사람이
네이버에 로그인해 둔)로 올린다. 그 흐름을 표에 남긴다.

  · 누가 언제 발행을 눌렀는가
  · 어느 발행기가 언제까지 가져갔는가(임대) — 도중에 죽으면 다시 줄에 선다
  · 몇 번 시도했고, 실패했다면 왜인가
  · 올라간 글의 주소·글 번호, 그리고 발행기가 실제로 열어 봤는가

발행된 글은 blog_histories 에도 들어간다(중복 검사의 기준). 어느 초안에서
나온 글인지 잇기 위해 draft_id 를 둔다.

Revision ID: bp26pub044t
Revises: hg26grd043s
"""
from alembic import op
import sqlalchemy as sa


revision = "bp26pub044t"
down_revision = "hg26grd043s"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("blog_drafts") as b:
        b.add_column(sa.Column("publish_requested_by", sa.String(length=100), nullable=True))
        b.add_column(sa.Column("publish_requested_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("publish_worker", sa.String(length=100), nullable=True))
        b.add_column(sa.Column("publish_lease_until", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("publish_attempts", sa.Integer(), nullable=False, server_default="0"))
        b.add_column(sa.Column("publish_error", sa.String(length=500), nullable=True))
        b.add_column(sa.Column("publish_session", sa.String(length=80), nullable=True))
        b.add_column(sa.Column("published_url", sa.String(length=500), nullable=True))
        b.add_column(sa.Column("published_log_no", sa.String(length=40), nullable=True))
        b.add_column(sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("published_verified", sa.Boolean(), nullable=False,
                               server_default=sa.false()))

    with op.batch_alter_table("blog_histories") as b:
        b.add_column(sa.Column("draft_id", sa.String(), nullable=True))
    op.create_index("ix_blog_histories_draft_id", "blog_histories", ["draft_id"])

    # 발행기의 마지막 신호. 서버가 여러 프로세스라 메모리에 둘 수 없다.
    op.create_table(
        "blog_publishers",
        sa.Column("worker", sa.String(length=100), primary_key=True),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("info", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("blog_publishers")
    op.drop_index("ix_blog_histories_draft_id", table_name="blog_histories")
    with op.batch_alter_table("blog_histories") as b:
        b.drop_column("draft_id")
    with op.batch_alter_table("blog_drafts") as b:
        for c in ("published_verified", "published_at", "published_log_no", "published_url",
                  "publish_session", "publish_error", "publish_attempts",
                  "publish_lease_until", "publish_worker",
                  "publish_requested_at", "publish_requested_by"):
            b.drop_column(c)
