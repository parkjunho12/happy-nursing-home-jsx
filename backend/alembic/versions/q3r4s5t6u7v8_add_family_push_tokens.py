"""add family_push_tokens table

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa

revision = "q3r4s5t6u7v8"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_index(table: str, index: str) -> bool:
    if not _has_table(table):
        return False
    return index in [i["name"] for i in sa.inspect(op.get_bind()).get_indexes(table)]


def upgrade():
    if not _has_table("family_push_tokens"):
        op.create_table(
            "family_push_tokens",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("guardian_id", sa.String(), nullable=False),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("platform", sa.String(), server_default="android"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
    # 인덱스는 존재하지 않을 때만 생성 (중복 방지)
    if not _has_index("family_push_tokens", "ix_family_push_tokens_guardian_id"):
        op.create_index("ix_family_push_tokens_guardian_id", "family_push_tokens", ["guardian_id"])
    if not _has_index("family_push_tokens", "ix_family_push_tokens_token"):
        op.create_index("ix_family_push_tokens_token", "family_push_tokens", ["token"], unique=True)


def downgrade():
    if _has_table("family_push_tokens"):
        op.drop_table("family_push_tokens")
