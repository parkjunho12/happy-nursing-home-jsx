"""add created_by_id to schedule_events (일정 소유자 권한)

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7c8d9e0f1a2'
down_revision = 'a6b7c8d9e0f1'
branch_labels = None
depends_on = None

TABLE = 'schedule_events'


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns(TABLE)]
    if 'created_by_id' not in cols:
        op.add_column(TABLE, sa.Column('created_by_id', sa.String(), nullable=True))
        op.create_index('ix_schedule_events_created_by_id', TABLE, ['created_by_id'])


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns(TABLE)]
    if 'created_by_id' in cols:
        op.drop_index('ix_schedule_events_created_by_id', table_name=TABLE)
        op.drop_column(TABLE, 'created_by_id')
