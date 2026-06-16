"""add staff accounts and checklist assignments

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-15 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. users 테이블 컬럼 추가 ────────────────────────────────────────────
    op.add_column('users', sa.Column('position',   sa.String(50),  nullable=True))   # 직책 (원장, 사무국장, 요양보호사 등)
    op.add_column('users', sa.Column('department', sa.String(50),  nullable=True))   # 부서
    op.add_column('users', sa.Column('phone',      sa.String(20),  nullable=True))
    op.add_column('users', sa.Column('is_active',  sa.Boolean(),   server_default='true'))

    # role enum에 MANAGER 추가 (PostgreSQL)
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'MANAGER'")

    # ── 2. checklist_items 에 assigned_user_id 추가 ──────────────────────────
    op.add_column('checklist_items',
        sa.Column('assigned_user_id', sa.String(), nullable=True, index=True))
    op.add_column('checklist_items',
        sa.Column('assigned_by',      sa.String(), nullable=True))
    op.add_column('checklist_items',
        sa.Column('assigned_at',      sa.DateTime(timezone=True), nullable=True))

    # ── 3. checklist_occurrences 에 담당자/상태 추가 ─────────────────────────
    op.add_column('checklist_occurrences',
        sa.Column('assigned_user_id',    sa.String(), nullable=True))
    op.add_column('checklist_occurrences',
        sa.Column('completed_by_user_id',sa.String(), nullable=True))
    op.add_column('checklist_occurrences',
        sa.Column('rejected_by_user_id', sa.String(), nullable=True))
    op.add_column('checklist_occurrences',
        sa.Column('rejected_at',         sa.DateTime(timezone=True), nullable=True))
    op.add_column('checklist_occurrences',
        sa.Column('rejection_reason',    sa.Text(), nullable=True))
    op.add_column('checklist_occurrences',
        sa.Column('attachment_url',      sa.String(500), nullable=True))
    # status 확장: 기존 pending|completed|overdue → in_progress|needs_revision 추가
    op.add_column('checklist_occurrences',
        sa.Column('extended_status', sa.String(30), nullable=True))  # in_progress|needs_revision

    # ── 4. 활동 로그 테이블 ──────────────────────────────────────────────────
    op.create_table(
        'checklist_activity_logs',
        sa.Column('id',              sa.String(),  primary_key=True),
        sa.Column('checklist_item_id', sa.String(), nullable=False, index=True),
        sa.Column('occurrence_id',   sa.String(), nullable=True, index=True),
        sa.Column('actor_user_id',   sa.String(), nullable=False),  # 행위자
        sa.Column('action',          sa.String(50), nullable=False),  # assigned|completed|rejected|status_changed
        sa.Column('from_status',     sa.String(30), nullable=True),
        sa.Column('to_status',       sa.String(30), nullable=True),
        sa.Column('from_assignee',   sa.String(), nullable=True),
        sa.Column('to_assignee',     sa.String(), nullable=True),
        sa.Column('note',            sa.Text(), nullable=True),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('checklist_activity_logs')
    for col in ['extended_status','attachment_url','rejection_reason',
                'rejected_at','rejected_by_user_id','completed_by_user_id','assigned_user_id']:
        op.drop_column('checklist_occurrences', col)
    for col in ['assigned_at','assigned_by','assigned_user_id']:
        op.drop_column('checklist_items', col)
    for col in ['is_active','phone','department','position']:
        op.drop_column('users', col)
