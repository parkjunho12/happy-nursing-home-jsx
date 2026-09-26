"""식이 변경 후속조치 — 욕구사정·급여제공계획서.

식사 형태가 바뀌면 서류도 따라가야 한다. 주방에 알리려고 식이를 바꾸는
사람과 서류를 쓰는 사람이 달라서, 말로 전하면 잊힌다. 바꾸는 순간 할 일을
한 줄 만들어 끝날 때까지 대시보드에 띄운다.

Revision ID: df26fu054b
Revises: na26nu053a
"""
from alembic import op
import sqlalchemy as sa

revision = "df26fu054b"
down_revision = "na26nu053a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "diet_followups",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("change_id", sa.String(), nullable=True),
        sa.Column("resident_id", sa.String(), nullable=False),
        sa.Column("resident_name", sa.String(length=100), nullable=True),
        sa.Column("floor", sa.String(length=20), nullable=True),
        sa.Column("room", sa.String(length=10), nullable=True),
        sa.Column("effective_date", sa.String(length=10), nullable=False),
        sa.Column("before_label", sa.String(length=60), nullable=True),
        sa.Column("after_label", sa.String(length=60), nullable=True),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("assess_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assess_by", sa.String(length=100), nullable=True),
        sa.Column("plan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("plan_by", sa.String(length=100), nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("done_by", sa.String(length=100), nullable=True),
        sa.Column("skip_reason", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_diet_followups_change_id", "diet_followups", ["change_id"])
    op.create_index("ix_diet_followups_resident_id", "diet_followups", ["resident_id"])
    op.create_index("ix_diet_followups_effective_date", "diet_followups", ["effective_date"])
    op.create_index("ix_diet_followups_done_at", "diet_followups", ["done_at"])
    op.create_index("ix_diet_followups_created_at", "diet_followups", ["created_at"])
    op.create_index("ix_diet_fu_open", "diet_followups", ["done_at", "effective_date"])


def downgrade() -> None:
    op.drop_index("ix_diet_fu_open", table_name="diet_followups")
    op.drop_index("ix_diet_followups_created_at", table_name="diet_followups")
    op.drop_index("ix_diet_followups_done_at", table_name="diet_followups")
    op.drop_index("ix_diet_followups_effective_date", table_name="diet_followups")
    op.drop_index("ix_diet_followups_resident_id", table_name="diet_followups")
    op.drop_index("ix_diet_followups_change_id", table_name="diet_followups")
    op.drop_table("diet_followups")
