"""add carefor_residents and carefor_leave_records

Revision ID: l1m2n3o4p5q6
Revises: k2f3a4b5c6d7
Create Date: 2026-06-16
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'l1m2n3o4p5q6'
down_revision: Union[str, None] = 'k2f3a4b5c6d7'
branch_labels = None
depends_on = None


def _exists(conn, table: str) -> bool:
    r = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name=:t"
    ), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()

    if not _exists(conn, 'carefor_residents'):
        op.create_table(
            'carefor_residents',
            sa.Column('id',             sa.String, primary_key=True),
            sa.Column('resident_code',  sa.String, nullable=True),
            sa.Column('name',           sa.String, nullable=False),
            sa.Column('birth_date',     sa.String, nullable=True),
            sa.Column('gender',         sa.String, nullable=True),
            sa.Column('care_grade',     sa.String, nullable=True),
            sa.Column('admission_date', sa.String, nullable=True),
            sa.Column('discharge_date', sa.String, nullable=True),
            sa.Column('room_name',      sa.String, nullable=True),
            sa.Column('status',         sa.String, server_default='active'),
            sa.Column('raw_data',       postgresql.JSONB, nullable=True),
            sa.Column('created_at',     sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at',     sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )
        op.create_index('ix_carefor_residents_name',          'carefor_residents', ['name'])
        op.create_index('ix_carefor_residents_resident_code', 'carefor_residents', ['resident_code'])
        op.create_index('ix_carefor_residents_status',        'carefor_residents', ['status'])

    if not _exists(conn, 'carefor_leave_records'):
        op.create_table(
            'carefor_leave_records',
            sa.Column('id',            sa.String, primary_key=True),
            sa.Column('resident_id',   sa.String, nullable=True),
            sa.Column('resident_name', sa.String, nullable=False),
            sa.Column('resident_code', sa.String, nullable=True),
            sa.Column('leave_type',    sa.String, nullable=True),
            sa.Column('start_date',    sa.String, nullable=True),
            sa.Column('start_time',    sa.String, nullable=True),
            sa.Column('end_date',      sa.String, nullable=True),
            sa.Column('end_time',      sa.String, nullable=True),
            sa.Column('reason',        sa.Text,   nullable=True),
            sa.Column('guardian_name', sa.String, nullable=True),
            sa.Column('memo',          sa.Text,   nullable=True),
            sa.Column('raw_data',      postgresql.JSONB, nullable=True),
            sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )
        op.create_index('ix_carefor_leave_resident_name', 'carefor_leave_records', ['resident_name'])
        op.create_index('ix_carefor_leave_start_date',    'carefor_leave_records', ['start_date'])
        op.create_index('ix_carefor_leave_end_date',      'carefor_leave_records', ['end_date'])


def downgrade() -> None:
    conn = op.get_bind()
    if _exists(conn, 'carefor_leave_records'):
        op.drop_table('carefor_leave_records')
    if _exists(conn, 'carefor_residents'):
        op.drop_table('carefor_residents')
