"""치료 프로그램 조 편성 — 조·조원·시간표.

작업치료사 한 사람이 예순여덟 분을 매일 볼 수 없어 조로 나눈다. 조마다
요일과 시각을 정해 두면 그 시간에 방송으로 부르고 알림을 보낼 수 있다.

조원 표의 resident_id 에 unique 를 건다. 한 분이 두 조에 들어가면 같은
시간에 두 곳에서 이름을 부른다. 화면에서 막는 것으로는 부족하다 —
두 사람이 동시에 편성하면 뚫린다.

Revision ID: th26group019s
Revises: ai26edit018r
"""
from alembic import op
import sqlalchemy as sa


revision = "th26group019s"
down_revision = "ai26edit018r"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "therapy_groups",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("floor", sa.String(length=20), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False, server_default="gather"),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_therapy_groups_floor", "therapy_groups", ["floor"])

    op.create_table(
        "therapy_group_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("resident_id", sa.String(), nullable=False),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("resident_id", name="uq_therapy_member_resident"),
    )
    op.create_index("ix_therapy_member_group", "therapy_group_members", ["group_id"])

    op.create_table(
        "therapy_slots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=True),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("place", sa.String(length=60), nullable=True),
        sa.Column("activity", sa.String(length=120), nullable=True),
        sa.Column("broadcast", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notify", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("lead_min", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_therapy_slots_group_id", "therapy_slots", ["group_id"])
    op.create_index("ix_therapy_slot_day_time", "therapy_slots", ["weekday", "start_time"])


def downgrade() -> None:
    op.drop_table("therapy_slots")
    op.drop_table("therapy_group_members")
    op.drop_table("therapy_groups")
