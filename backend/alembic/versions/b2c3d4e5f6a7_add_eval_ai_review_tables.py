"""add eval ai review tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── eval_guidelines (.md 가이드라인 문서) ─────────────────────
    op.create_table(
        'eval_guidelines',
        sa.Column('id',         sa.String(),    primary_key=True),
        sa.Column('title',      sa.String(200), nullable=False),
        sa.Column('filename',   sa.String(255), nullable=True),
        sa.Column('content',    sa.Text(),      nullable=False),
        sa.Column('char_count', sa.Integer(),   server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # ── eval_ai_reviews (AI 검토 결과 이력) ───────────────────────
    op.create_table(
        'eval_ai_reviews',
        sa.Column('id',              sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column('guideline_id',    sa.String(),    nullable=True),
        sa.Column('guideline_title', sa.String(200), nullable=True),
        sa.Column('domain_id',       sa.String(),    nullable=True),
        sa.Column('overall_score',   sa.Integer(),   server_default='0'),
        sa.Column('summary',         sa.Text(),      server_default=''),
        sa.Column('result_json',     sa.Text(),      nullable=False),
        sa.Column('model',           sa.String(50),  nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_eval_ai_reviews_created_at', 'eval_ai_reviews', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_eval_ai_reviews_created_at', 'eval_ai_reviews')
    op.drop_table('eval_ai_reviews')
    op.drop_table('eval_guidelines')
