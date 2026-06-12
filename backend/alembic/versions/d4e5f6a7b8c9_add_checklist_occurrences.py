"""add checklist_occurrences table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-12 00:00:00.000000

ChecklistItem을 템플릿으로, ChecklistOccurrence를 실제 주기별 이력으로 사용.
기존 CompletionRecord, ChecklistItem은 그대로 유지.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'checklist_occurrences',
        sa.Column('id',                sa.String(),    primary_key=True),
        sa.Column('checklist_item_id', sa.String(),    nullable=False),
        sa.Column('period_key',        sa.String(20),  nullable=False),
        sa.Column('frequency',         sa.String(30),  nullable=False),
        sa.Column('scheduled_date',    sa.String(20),  nullable=False),
        sa.Column('due_date',          sa.String(20),  nullable=False),
        sa.Column('status',            sa.String(20),  nullable=False, server_default='pending'),
        sa.Column('completed_date',    sa.String(20),  nullable=True),
        sa.Column('memo',              sa.Text(),      server_default=''),
        sa.Column('attachment_name',   sa.String(200), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    # 조회 패턴에 맞는 인덱스
    op.create_index('ix_occ_checklist_item_id',  'checklist_occurrences', ['checklist_item_id'])
    op.create_index('ix_occ_period_key',         'checklist_occurrences', ['period_key'])
    op.create_index('ix_occ_status',             'checklist_occurrences', ['status'])
    op.create_index('ix_occ_due_date',           'checklist_occurrences', ['due_date'])
    # 복합: 특정 아이템의 특정 주기 조회 (중복 방지 쿼리용)
    op.create_index('ix_occ_item_period',        'checklist_occurrences',
                    ['checklist_item_id', 'period_key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_occ_item_period',       'checklist_occurrences')
    op.drop_index('ix_occ_due_date',          'checklist_occurrences')
    op.drop_index('ix_occ_status',            'checklist_occurrences')
    op.drop_index('ix_occ_period_key',        'checklist_occurrences')
    op.drop_index('ix_occ_checklist_item_id', 'checklist_occurrences')
    op.drop_table('checklist_occurrences')
