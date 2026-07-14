"""staff_monthly_hours — 직원별 월간 인정시간 수동 조정 저장

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'c8d9e0f1a2b3'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None

TABLE = 'staff_monthly_hours'


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE in insp.get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('staff_id', sa.String(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('hours', sa.Float(), nullable=False),
        sa.Column('memo', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('staff_id', 'year', 'month', name='uq_staff_month_hours'),
    )
    op.create_index('ix_staff_monthly_hours_staff_id', TABLE, ['staff_id'])
    op.create_index('ix_staff_monthly_hours_year', TABLE, ['year'])
    op.create_index('ix_staff_monthly_hours_month', TABLE, ['month'])


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE in insp.get_table_names():
        op.drop_table(TABLE)
