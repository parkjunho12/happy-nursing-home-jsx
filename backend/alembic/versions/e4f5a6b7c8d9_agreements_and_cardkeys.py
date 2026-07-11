"""add agreement doc columns + card_keys table

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f5a6b7c8d9'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None

_DOC_COLS = ['doc_withholding', 'doc_subholiday', 'doc_compleave', 'doc_privacy']


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'staff_hr_records' in tables:
        cols = [c['name'] for c in insp.get_columns('staff_hr_records')]
        for name in _DOC_COLS:
            if name not in cols:
                op.add_column('staff_hr_records', sa.Column(name, sa.Boolean(), nullable=True))

    if 'card_keys' not in tables:
        op.create_table(
            'card_keys',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('seq', sa.Integer(), nullable=True),
            sa.Column('card_number', sa.String(length=50), nullable=True),
            sa.Column('holder', sa.String(length=100), nullable=True),
            sa.Column('staff_id', sa.String(), nullable=True),
            sa.Column('deposit_date', sa.String(length=20), nullable=True),
            sa.Column('deposit_method', sa.String(length=50), nullable=True),
            sa.Column('deposit_amount', sa.String(length=30), nullable=True),
            sa.Column('returned', sa.Boolean(), nullable=True),
            sa.Column('return_date', sa.String(length=20), nullable=True),
            sa.Column('returner', sa.String(length=100), nullable=True),
            sa.Column('memo', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_card_keys_holder', 'card_keys', ['holder'])
        op.create_index('ix_card_keys_returned', 'card_keys', ['returned'])
        op.create_index('ix_card_keys_seq', 'card_keys', ['seq'])
        op.create_index('ix_card_keys_staff_id', 'card_keys', ['staff_id'])


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()
    if 'card_keys' in tables:
        op.drop_table('card_keys')
    if 'staff_hr_records' in tables:
        cols = [c['name'] for c in insp.get_columns('staff_hr_records')]
        for name in reversed(_DOC_COLS):
            if name in cols:
                op.drop_column('staff_hr_records', name)
