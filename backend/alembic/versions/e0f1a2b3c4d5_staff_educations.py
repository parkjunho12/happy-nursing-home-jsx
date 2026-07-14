"""staff_educations (직원 법정·평가 의무교육 계획/실시 기록)

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'e0f1a2b3c4d5'
down_revision = 'd9e0f1a2b3c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'staff_educations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('division', sa.String(), nullable=False, server_default='기타'),
        sa.Column('eval_no', sa.String(), nullable=True),
        sa.Column('topic', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('org', sa.String(), nullable=True),
        sa.Column('requirement', sa.Text(), nullable=True),
        sa.Column('sort', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('done', sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column('plan_date', sa.String(), nullable=True),
        sa.Column('done_date', sa.String(), nullable=True),
        sa.Column('instructor', sa.String(), nullable=True),
        sa.Column('attendee_count', sa.Integer(), nullable=True),
        sa.Column('attendees', sa.Text(), nullable=True),
        sa.Column('material', sa.Text(), nullable=True),
        sa.Column('memo', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column('updated_by_name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_staff_educations_year', 'staff_educations', ['year'])
    op.create_index('ix_staff_educations_month', 'staff_educations', ['month'])
    op.create_index('ix_staff_educations_done', 'staff_educations', ['done'])


def downgrade() -> None:
    op.drop_index('ix_staff_educations_done', table_name='staff_educations')
    op.drop_index('ix_staff_educations_month', table_name='staff_educations')
    op.drop_index('ix_staff_educations_year', table_name='staff_educations')
    op.drop_table('staff_educations')
