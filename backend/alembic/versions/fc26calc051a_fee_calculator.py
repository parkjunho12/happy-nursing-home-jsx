"""수가(급여) 계산기 — 비공개 원본 스냅샷 + 월별 시나리오 (ADMIN 전용)

Revision ID: fc26calc051a
Revises: cv26vs050z
"""
from alembic import op
import sqlalchemy as sa

revision = "fc26calc051a"
down_revision = "cv26vs050z"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fee_calculator_source",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("sheets", sa.JSON(), nullable=False),
        sa.Column("captured_at", sa.String(length=40), nullable=False),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 유니크 제약은 create_table 안에 그대로 넣는다 — SQLite 는 ALTER TABLE 로
    # 제약을 나중에 붙이는 것을 지원하지 않는다(운영은 Postgres 지만, 로컬
    # 개발/테스트에서 SQLite 로 이 마이그레이션을 그대로 적용해 볼 수 있게 해 둔다).
    op.create_table(
        "fee_calculator_scenarios",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("month", name="uq_fee_calc_scenario_month"),
    )
    op.create_index("ix_fee_calculator_scenarios_month", "fee_calculator_scenarios", ["month"])


def downgrade() -> None:
    op.drop_index("ix_fee_calculator_scenarios_month", table_name="fee_calculator_scenarios")
    op.drop_table("fee_calculator_scenarios")
    op.drop_table("fee_calculator_source")
