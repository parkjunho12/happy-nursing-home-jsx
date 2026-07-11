"""holiday_calendar table + KR holiday seed (2025-2027)

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa
import uuid

revision = 'f5a6b7c8d9e0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None

SEED = [('2025-01-01', '신정', 'public'), ('2025-01-27', '임시공휴일', 'public'), ('2025-01-28', '설날 연휴', 'public'), ('2025-01-29', '설날', 'public'), ('2025-01-30', '설날 연휴', 'public'), ('2025-03-01', '삼일절', 'public'), ('2025-03-03', '삼일절 대체공휴일', 'public'), ('2025-05-01', '근로자의 날', 'public'), ('2025-05-05', "Buddha's Birthday; Children's Day", 'public'), ('2025-05-06', "Buddha's Birthday; Alternative holiday for Children's Day 대체공휴일", 'public'), ('2025-06-03', '대통령선거일', 'public'), ('2025-06-06', '현충일', 'public'), ('2025-08-15', '광복절', 'public'), ('2025-10-03', '개천절', 'public'), ('2025-10-05', '추석 연휴', 'public'), ('2025-10-06', '추석', 'public'), ('2025-10-07', '추석 연휴', 'public'), ('2025-10-08', '추석 대체공휴일', 'public'), ('2025-10-09', '한글날', 'public'), ('2025-12-25', '성탄절', 'public'), ('2026-01-01', '신정', 'public'), ('2026-02-16', '설날 연휴', 'public'), ('2026-02-17', '설날', 'public'), ('2026-02-18', '설날 연휴', 'public'), ('2026-03-01', '삼일절', 'public'), ('2026-03-02', '삼일절 대체공휴일', 'public'), ('2026-05-01', '근로자의 날', 'public'), ('2026-05-05', '어린이날', 'public'), ('2026-05-24', '부처님오신날', 'public'), ('2026-05-25', '부처님오신날 대체공휴일', 'public'), ('2026-06-03', '지방선거일', 'public'), ('2026-06-06', '현충일', 'public'), ('2026-07-17', '제헌절', 'public'), ('2026-08-15', '광복절', 'public'), ('2026-08-17', '광복절 대체공휴일', 'public'), ('2026-09-24', '추석 연휴', 'public'), ('2026-09-25', '추석', 'public'), ('2026-09-26', '추석 연휴', 'public'), ('2026-10-03', '개천절', 'public'), ('2026-10-05', '개천절 대체공휴일', 'public'), ('2026-10-09', '한글날', 'public'), ('2026-12-25', '성탄절', 'public'), ('2027-01-01', '신정', 'public'), ('2027-02-06', '설날 연휴', 'public'), ('2027-02-07', '설날', 'public'), ('2027-02-08', '설날 연휴', 'public'), ('2027-02-09', '설날 대체공휴일', 'public'), ('2027-03-01', '삼일절', 'public'), ('2027-05-01', '근로자의 날', 'public'), ('2027-05-05', '어린이날', 'public'), ('2027-05-13', '부처님오신날', 'public'), ('2027-06-06', '현충일', 'public'), ('2027-07-17', '제헌절', 'public'), ('2027-08-15', '광복절', 'public'), ('2027-08-16', '광복절 대체공휴일', 'public'), ('2027-09-14', '추석 연휴', 'public'), ('2027-09-15', '추석', 'public'), ('2027-09-16', '추석 연휴', 'public'), ('2027-10-03', '개천절', 'public'), ('2027-10-04', '개천절 대체공휴일', 'public'), ('2027-10-09', '한글날', 'public'), ('2027-10-11', '한글날 대체공휴일', 'public'), ('2027-12-25', '성탄절', 'public'), ('2027-12-27', '성탄절 대체공휴일', 'public')]


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'holiday_calendar' not in insp.get_table_names():
        op.create_table(
            'holiday_calendar',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('date', sa.String(length=20), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=True),
            sa.Column('kind', sa.String(length=20), nullable=True),
            sa.Column('active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_holiday_calendar_date', 'holiday_calendar', ['date'])
        op.create_index('ix_holiday_calendar_active', 'holiday_calendar', ['active'])
        t = sa.table('holiday_calendar',
                     sa.column('id', sa.String), sa.column('date', sa.String),
                     sa.column('name', sa.String), sa.column('kind', sa.String),
                     sa.column('active', sa.Boolean))
        op.bulk_insert(t, [{'id': str(uuid.uuid4()), 'date': d, 'name': n, 'kind': k, 'active': True}
                           for (d, n, k) in SEED])


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'holiday_calendar' in insp.get_table_names():
        op.drop_table('holiday_calendar')
