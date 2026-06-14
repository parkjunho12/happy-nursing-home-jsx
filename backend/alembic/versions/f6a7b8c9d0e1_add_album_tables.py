"""add album tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 기존 테이블이 있을 수 있으므로 먼저 삭제
    op.execute("DROP TABLE IF EXISTS album_media CASCADE")
    op.execute("DROP TABLE IF EXISTS albums CASCADE")
    op.execute("DROP TABLE IF EXISTS resident_guardians CASCADE")
    op.execute("DROP TABLE IF EXISTS guardian_accounts CASCADE")

    # 보호자 계정
    op.create_table(
        'guardian_accounts',
        sa.Column('id',            sa.String(),    primary_key=True),
        sa.Column('name',          sa.String(50),  nullable=False),
        sa.Column('phone',         sa.String(20),  nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active',     sa.Boolean(),   server_default='true'),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # 수급자 ↔ 보호자 연결
    op.create_table(
        'resident_guardians',
        sa.Column('id',          sa.String(),   primary_key=True),
        sa.Column('resident_id', sa.String(),   nullable=False, index=True),
        sa.Column('guardian_id', sa.String(),   nullable=False, index=True),
        sa.Column('relation',    sa.String(20), nullable=True),   # 아들, 딸, 배우자 등
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # 앨범
    op.create_table(
        'albums',
        sa.Column('id',          sa.String(),     primary_key=True),
        sa.Column('resident_id', sa.String(),     nullable=False, index=True),
        sa.Column('title',       sa.String(100),  nullable=False),
        sa.Column('description', sa.Text(),       nullable=True),
        sa.Column('cover_url',   sa.String(500),  nullable=True),
        sa.Column('is_public',   sa.Boolean(),    server_default='true'),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # 앨범 미디어
    op.create_table(
        'album_media',
        sa.Column('id',            sa.String(),    primary_key=True),
        sa.Column('album_id',      sa.String(),    nullable=False, index=True),
        sa.Column('media_type',    sa.String(10),  nullable=False),   # photo | video
        sa.Column('file_url',      sa.String(500), nullable=False),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('file_name',     sa.String(255), nullable=True),
        sa.Column('file_size',     sa.Integer(),   nullable=True),
        sa.Column('sort_order',    sa.Integer(),   server_default='0'),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('album_media')
    op.drop_table('albums')
    op.drop_table('resident_guardians')
    op.drop_table('guardian_accounts')
