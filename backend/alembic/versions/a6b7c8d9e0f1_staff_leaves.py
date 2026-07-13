"""add leaves (휴직 기간) to ltc_staff_members

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'a6b7c8d9e0f1'
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'ltc_staff_members' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('ltc_staff_members')]
    if 'leaves' not in cols:
        op.add_column('ltc_staff_members', sa.Column('leaves', sa.JSON(), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'ltc_staff_members' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('ltc_staff_members')]
    if 'leaves' in cols:
        op.drop_column('ltc_staff_members', 'leaves')
