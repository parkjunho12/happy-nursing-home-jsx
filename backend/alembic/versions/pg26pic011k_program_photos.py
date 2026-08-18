"""프로그램 사진

Revision ID: pg26pic011k
Revises: ws26lock010j
"""
from alembic import op
import sqlalchemy as sa

revision = "pg26pic011k"
down_revision = "ws26lock010j"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "program_photos",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("grp", sa.String(50), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("thumbnail_url", sa.String(500), nullable=True),
        sa.Column("media_type", sa.String(10), nullable=False, server_default="photo"),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("caption", sa.String(300), nullable=True),
        sa.Column("uploaded_by", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_program_photos_month", "program_photos", ["month"])
    op.create_index("ix_program_photos_created_at", "program_photos", ["created_at"])
    # 한 달치를 날짜순으로 훑는 화면이 기본이라 같이 걸어둔다
    op.create_index("ix_program_photos_md", "program_photos", ["month", "day"])


def downgrade() -> None:
    op.drop_index("ix_program_photos_md", table_name="program_photos")
    op.drop_index("ix_program_photos_created_at", table_name="program_photos")
    op.drop_index("ix_program_photos_month", table_name="program_photos")
    op.drop_table("program_photos")
