"""internal_notices — 직원용 내부 공지사항

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'd9e0f1a2b3c4'
down_revision = 'c8d9e0f1a2b3'
branch_labels = None
depends_on = None

TABLE = 'internal_notices'


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE in insp.get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('level', sa.String(length=20), nullable=True),
        sa.Column('pinned', sa.Boolean(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('author_id', sa.String(), nullable=True),
        sa.Column('author_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_internal_notices_pinned', TABLE, ['pinned'])
    op.create_index('ix_internal_notices_active', TABLE, ['active'])


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE in insp.get_table_names():
        op.drop_table(TABLE)
