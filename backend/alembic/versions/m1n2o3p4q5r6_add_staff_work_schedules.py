"""add staff_work_schedules

Revision ID: m1n2o3p4q5r6
Revises: l1m2n3o4p5q6
Create Date: 2026-06-16
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'm1n2o3p4q5r6'
down_revision: Union[str, None] = 'l1m2n3o4p5q6'
branch_labels = None
depends_on = None


def _exists(conn, table: str) -> bool:
    r = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name=:t"
    ), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _exists(conn, 'staff_work_schedules'):
        op.create_table(
            'staff_work_schedules',
            sa.Column('id',          sa.String,  primary_key=True),
            sa.Column('staff_name',  sa.String,  nullable=False),
            sa.Column('user_id',     sa.String,  nullable=True),
            sa.Column('work_date',   sa.String,  nullable=False),
            sa.Column('shift_code',  sa.String,  nullable=True),
            sa.Column('shift_label', sa.String,  nullable=True),
            sa.Column('start_time',  sa.String,  nullable=True),
            sa.Column('end_time',    sa.String,  nullable=True),
            sa.Column('is_working',  sa.Boolean, server_default=sa.text('true')),
            sa.Column('raw_data',    postgresql.JSONB, nullable=True),
            sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )
        op.create_index('ix_sws_staff_name',  'staff_work_schedules', ['staff_name'])
        op.create_index('ix_sws_user_id',     'staff_work_schedules', ['user_id'])
        op.create_index('ix_sws_work_date',   'staff_work_schedules', ['work_date'])
        op.create_index('ix_sws_is_working',  'staff_work_schedules', ['is_working'])
        op.create_index('ix_sws_name_date',   'staff_work_schedules', ['staff_name', 'work_date'])


def downgrade() -> None:
    conn = op.get_bind()
    if _exists(conn, 'staff_work_schedules'):
        op.drop_table('staff_work_schedules')
