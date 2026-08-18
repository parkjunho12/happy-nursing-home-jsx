"""프로그램 사진 — 찍은 시각 + 프로그램 미지정 허용

Revision ID: pg26day014n
Revises: rt26own013m

사진을 먼저 날짜별로 담고 프로그램은 나중에 붙이는 흐름으로 바꾼다.
"""
from alembic import op
import sqlalchemy as sa

revision = "pg26day014n"
down_revision = "rt26own013m"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("program_photos",
                  sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True))
    # 프로그램을 정하지 않은 채로 올릴 수 있게 한다
    op.alter_column("program_photos", "title",
                    existing_type=sa.String(200), nullable=True)


def downgrade() -> None:
    # 되돌리기 전에 빈 값을 채워야 NOT NULL 로 돌아갈 수 있다
    op.execute("UPDATE program_photos SET title = '미지정' WHERE title IS NULL")
    op.alter_column("program_photos", "title",
                    existing_type=sa.String(200), nullable=False)
    op.drop_column("program_photos", "taken_at")
