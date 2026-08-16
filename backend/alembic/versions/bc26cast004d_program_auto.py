"""프로그램 시간표 자동 방송 — 예약 출처 구분 + 프로그램 방송 설정

Revision ID: bc26cast004d
Revises: bc26cast003c
"""
from alembic import op
import sqlalchemy as sa

revision = "bc26cast004d"
down_revision = "bc26cast003c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 사람이 만든 예약과 프로그램표에서 자동으로 만든 예약을 구분한다.
    # 자동 동기화가 사람 예약을 지우는 일이 없어야 한다.
    op.add_column("broadcast_schedules",
                  sa.Column("source", sa.String(10), nullable=False,
                            server_default="MANUAL"))
    op.add_column("broadcast_schedules", sa.Column("source_key", sa.String(80), nullable=True))
    op.create_index("ix_broadcast_schedules_source", "broadcast_schedules", ["source"])
    # 같은 키가 두 번 들어가면 같은 방송이 두 번 나간다 — DB 가 막는다
    op.create_unique_constraint("uq_broadcast_schedules_source_key",
                                "broadcast_schedules", ["source_key"])
    op.add_column("program_settings", sa.Column("broadcast", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("program_settings", "broadcast")
    op.drop_constraint("uq_broadcast_schedules_source_key", "broadcast_schedules", type_="unique")
    op.drop_index("ix_broadcast_schedules_source", table_name="broadcast_schedules")
    op.drop_column("broadcast_schedules", "source_key")
    op.drop_column("broadcast_schedules", "source")
