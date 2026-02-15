"""add ai analysis fields to contacts

Revision ID: dd5268ecd651
Revises: <PUT_DOWN_REVISION_HERE>
Create Date: 2026-02-15 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "dd5268ecd651"
down_revision = "783117d47329"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ✅ contacts 테이블에 AI 분석 필드 추가
    op.add_column("contacts", sa.Column("ai_summary", sa.Text(), nullable=True))
    op.add_column("contacts", sa.Column("ai_category", sa.String(length=32), nullable=True))
    op.add_column("contacts", sa.Column("ai_urgency", sa.String(length=16), nullable=True))
    op.add_column(
        "contacts",
        sa.Column("ai_next_actions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("contacts", sa.Column("ai_model", sa.String(length=32), nullable=True))
    op.add_column("contacts", sa.Column("ai_created_at", sa.DateTime(timezone=True), nullable=True))

    # ✅ 인덱스 추가 (필터링용)
    op.create_index("ix_contacts_ai_category", "contacts", ["ai_category"], unique=False)
    op.create_index("ix_contacts_ai_urgency", "contacts", ["ai_urgency"], unique=False)


def downgrade() -> None:
    # ✅ 인덱스 제거
    op.drop_index("ix_contacts_ai_urgency", table_name="contacts")
    op.drop_index("ix_contacts_ai_category", table_name="contacts")

    # ✅ 컬럼 제거
    op.drop_column("contacts", "ai_created_at")
    op.drop_column("contacts", "ai_model")
    op.drop_column("contacts", "ai_next_actions")
    op.drop_column("contacts", "ai_urgency")
    op.drop_column("contacts", "ai_category")
    op.drop_column("contacts", "ai_summary")
