"""add staff detail fields (resident_no, address, phone, license, bank)

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None

_COLS = [
    ('resident_no', sa.String(length=20)),
    ('address', sa.Text()),
    ('phone', sa.String(length=30)),
    ('license_date', sa.String(length=20)),
    ('license_no', sa.String(length=50)),
    ('bank_account', sa.String(length=50)),
]


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'ltc_staff_members' not in insp.get_table_names():
        return
    existing = [c['name'] for c in insp.get_columns('ltc_staff_members')]
    for name, coltype in _COLS:
        if name not in existing:
            op.add_column('ltc_staff_members', sa.Column(name, coltype, nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'ltc_staff_members' not in insp.get_table_names():
        return
    existing = [c['name'] for c in insp.get_columns('ltc_staff_members')]
    for name, _ in reversed(_COLS):
        if name in existing:
            op.drop_column('ltc_staff_members', name)
