"""add address_detail to ltc_staff_members

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'ltc_staff_members' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('ltc_staff_members')]
    if 'address_detail' not in cols:
        op.add_column('ltc_staff_members', sa.Column('address_detail', sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'ltc_staff_members' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('ltc_staff_members')]
    if 'address_detail' in cols:
        op.drop_column('ltc_staff_members', 'address_detail')
