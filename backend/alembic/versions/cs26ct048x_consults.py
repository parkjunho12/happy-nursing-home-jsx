"""입소 상담 기록 — 전화를 받으면서 채우는 한 장.

종이에 받아 적으면 그 종이를 쥔 사람만 안다. 며칠 뒤 보호자가 다시
전화했을 때 지난번에 무엇을 여쭸는지 알 수 없어 같은 것을 또 묻게 된다.

Revision ID: cs26ct048x
Revises: wm26mh047w
"""
from alembic import op
import sqlalchemy as sa

revision = "cs26ct048x"
down_revision = "wm26mh047w"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "consults",
        sa.Column("id", sa.String(), primary_key=True),
        # 상담 개요
        sa.Column("consulted_on", sa.String(length=10), nullable=False),
        sa.Column("consulted_at", sa.String(length=5), nullable=True),
        sa.Column("counselor", sa.String(length=50), nullable=True),
        sa.Column("route", sa.String(length=30), nullable=True),
        sa.Column("method", sa.String(length=20), nullable=True),
        sa.Column("caller", sa.String(length=50), nullable=True),
        # 어르신
        sa.Column("resident_name", sa.String(length=50), nullable=True),
        sa.Column("gender", sa.String(length=10), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("height_cm", sa.String(length=10), nullable=True),
        sa.Column("weight_kg", sa.String(length=10), nullable=True),
        sa.Column("living", sa.String(length=40), nullable=True),
        sa.Column("living_note", sa.String(length=200), nullable=True),
        # 요양등급 · 비용
        sa.Column("grade", sa.String(length=20), nullable=True),
        sa.Column("benefit", sa.String(length=20), nullable=True),
        sa.Column("copay", sa.String(length=20), nullable=True),
        sa.Column("grade_note", sa.String(length=200), nullable=True),
        # 건강 상태
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("behavior", sa.Text(), nullable=True),
        sa.Column("sleep", sa.String(length=200), nullable=True),
        sa.Column("hearing", sa.String(length=40), nullable=True),
        sa.Column("hearing_aid", sa.String(length=20), nullable=True),
        sa.Column("vision", sa.String(length=40), nullable=True),
        sa.Column("glasses", sa.String(length=20), nullable=True),
        sa.Column("speech", sa.String(length=40), nullable=True),
        sa.Column("mobility", sa.String(length=40), nullable=True),
        sa.Column("toileting", sa.String(length=40), nullable=True),
        sa.Column("eating", sa.String(length=40), nullable=True),
        sa.Column("diet", sa.String(length=40), nullable=True),
        sa.Column("health_note", sa.Text(), nullable=True),
        # 보호자 · 가족
        sa.Column("children", sa.String(length=40), nullable=True),
        sa.Column("guardian_name", sa.String(length=50), nullable=True),
        sa.Column("guardian_relation", sa.String(length=30), nullable=True),
        sa.Column("guardian_phone", sa.String(length=30), nullable=True),
        sa.Column("address", sa.String(length=200), nullable=True),
        # 진행
        sa.Column("checkup", sa.String(length=40), nullable=True),
        sa.Column("checkup_note", sa.String(length=200), nullable=True),
        sa.Column("wish_date", sa.String(length=10), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("guided", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="open"),
        sa.Column("followup_on", sa.String(length=10), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_consults_consulted_on", "consults", ["consulted_on"])
    op.create_index("ix_consults_status", "consults", ["status"])
    op.create_index("ix_consults_followup_on", "consults", ["followup_on"])
    op.create_index("ix_consults_created_at", "consults", ["created_at"])
    op.create_index("ix_consult_date", "consults", ["consulted_on", "status"])


def downgrade() -> None:
    op.drop_index("ix_consult_date", table_name="consults")
    op.drop_index("ix_consults_created_at", table_name="consults")
    op.drop_index("ix_consults_followup_on", table_name="consults")
    op.drop_index("ix_consults_status", table_name="consults")
    op.drop_index("ix_consults_consulted_on", table_name="consults")
    op.drop_table("consults")
