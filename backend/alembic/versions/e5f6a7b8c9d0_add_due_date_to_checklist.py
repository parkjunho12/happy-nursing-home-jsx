"""add due_date and one_time frequency to checklist_items

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-13 00:00:00.000000

일회성 체크리스트 지원:
- checklist_items.due_date 컬럼 추가 (one_time 타입의 기한)
- frequency = 'one_time' 허용 (VARCHAR라 마이그레이션 불필요)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'checklist_items',
        sa.Column('due_date', sa.String(20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('checklist_items', 'due_date')
