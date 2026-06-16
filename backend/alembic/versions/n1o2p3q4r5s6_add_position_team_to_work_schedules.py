"""add position and team to staff_work_schedules

Revision ID: n1o2p3q4r5s6
Revises: m1n2o3p4q5r6
Create Date: 2026-06-16
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'n1o2p3q4r5s6'
down_revision: Union[str, None] = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def _has_col(conn, table, col):
    r = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": col})
    return r.fetchone() is not None


def upgrade():
    conn = op.get_bind()
    if not _has_col(conn, 'staff_work_schedules', 'position'):
        op.add_column('staff_work_schedules', sa.Column('position', sa.String, nullable=True))
    if not _has_col(conn, 'staff_work_schedules', 'team'):
        op.add_column('staff_work_schedules', sa.Column('team', sa.String, nullable=True))


def downgrade():
    conn = op.get_bind()
    if _has_col(conn, 'staff_work_schedules', 'team'):
        op.drop_column('staff_work_schedules', 'team')
    if _has_col(conn, 'staff_work_schedules', 'position'):
        op.drop_column('staff_work_schedules', 'position')
