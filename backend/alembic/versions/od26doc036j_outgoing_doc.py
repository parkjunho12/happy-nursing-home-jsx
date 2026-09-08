"""내보내야 할 문서 — 교부 목록과 그 기록.

체크리스트는 '입소할 때 해야 할 일' 처럼 정해진 목록인데, 이건 그때그때
생긴다(장기요양인정서 갱신이 나왔다, 진단서를 떼 드려야 한다). 미리 정해
둘 수 없어 표를 따로 둔다.

교부하면 목록에서만 내리고 줄은 남긴다. 지우면 언제 누가 건넸는지가 함께
사라지는데, 그게 정확히 나중에 필요해지는 정보다.

Revision ID: od26doc036j
Revises: cd26unreason035i
"""
from alembic import op
import sqlalchemy as sa


revision = "od26doc036j"
down_revision = "cd26unreason035i"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outgoing_docs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("person_id", sa.String(), nullable=True),
        sa.Column("person_name", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("target", sa.String(length=40), nullable=True),
        sa.Column("due_date", sa.String(length=10), nullable=True),
        sa.Column("issued_at", sa.String(length=10), nullable=True),
        sa.Column("issued_by", sa.String(length=100), nullable=True),
        sa.Column("issued_to", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_outgoing_doc_state", "outgoing_docs", ["issued_at", "created_at"])
    op.create_index("ix_outgoing_doc_person", "outgoing_docs", ["person_id"])
    op.create_index("ix_outgoing_docs_issued_at", "outgoing_docs", ["issued_at"])


def downgrade() -> None:
    op.drop_table("outgoing_docs")
