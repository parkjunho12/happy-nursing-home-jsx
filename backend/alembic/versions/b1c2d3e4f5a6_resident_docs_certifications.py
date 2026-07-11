"""add certifications json to resident_doc_status

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'resident_doc_status' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('resident_doc_status')]
        if 'certifications' not in cols:
            op.add_column('resident_doc_status', sa.Column('certifications', sa.JSON(), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'resident_doc_status' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('resident_doc_status')]
        if 'certifications' in cols:
            op.drop_column('resident_doc_status', 'certifications')
