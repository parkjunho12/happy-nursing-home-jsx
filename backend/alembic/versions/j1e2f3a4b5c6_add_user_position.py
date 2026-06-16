"""add position to users

Revision ID: j1e2f3a4b5c6
Revises: f6a7b8c9d0e1
Create Date: 2026-06-16 00:00:00.000000
"""
from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = 'j1e2f3a4b5c6'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def _has_column(table: str, col: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return col in [c["name"] for c in inspector.get_columns(table)]


def _has_type(type_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = :t"),
        {"t": type_name}
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # Enum 타입 생성
    if not _has_type("userposition"):
        op.execute("""
            CREATE TYPE userposition AS ENUM (
                '대표', '시설장', '이사',
                '사회복지사', '간호사', '간호조무사',
                '물리치료사', '요양보호사', '요양팀장'
            )
        """)

    if not _has_column("users", "position"):
        op.add_column("users",
            sa.Column("position",
                sa.Enum(
                    "대표", "시설장", "이사",
                    "사회복지사", "간호사", "간호조무사",
                    "물리치료사", "요양보호사", "요양팀장",
                    name="userposition", create_type=False
                ),
                nullable=True
            )
        )


def downgrade() -> None:
    if _has_column("users", "position"):
        op.drop_column("users", "position")
    op.execute("DROP TYPE IF EXISTS userposition")
