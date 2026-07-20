"""2026년 관공서 공휴일 시드 (holiday_calendar)

음력 명절(설·추석·부처님오신날)과 대체공휴일은 규칙만으로 계산할 수 없고,
운영 서버에 holidays 라이브러리가 없을 수도 있어 확인된 날짜를 직접 넣는다.
이미 있는 날짜는 건드리지 않는다.

2026년 특이사항:
 · 제헌절(7/17) — 2026년부터 관공서 공휴일로 재지정됨 (18년 만에 부활)
 · 지방선거일(6/3) — 제9회 전국동시지방선거 임시공휴일
 · 설날(2/16~18)·추석(9/24~26) 모두 일요일과 겹치지 않아 대체공휴일 없음

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
"""
import uuid
from alembic import op
import sqlalchemy as sa

revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None

TABLE = "holiday_calendar"

# (날짜, 이름, 종류) — 요일과 대체공휴일 규칙을 검산해 확정한 목록
HOLIDAYS_2026 = [
    ("2026-01-01", "신정", "public"),
    ("2026-02-16", "설날 연휴", "lunar"),
    ("2026-02-17", "설날", "lunar"),
    ("2026-02-18", "설날 연휴", "lunar"),
    ("2026-03-01", "삼일절", "public"),
    ("2026-03-02", "삼일절 대체공휴일", "substitute"),
    ("2026-05-01", "근로자의 날", "paid"),          # 관공서 공휴일 아님 · 유급휴일
    ("2026-05-05", "어린이날", "public"),
    ("2026-05-24", "부처님오신날", "lunar"),
    ("2026-05-25", "부처님오신날 대체공휴일", "substitute"),
    ("2026-06-03", "제9회 전국동시지방선거", "custom"),        # 임시공휴일
    ("2026-06-06", "현충일", "public"),
    ("2026-07-17", "제헌절", "public"),                        # 2026년부터 공휴일로 재지정
    ("2026-08-15", "광복절", "public"),
    ("2026-08-17", "광복절 대체공휴일", "substitute"),
    ("2026-09-24", "추석 연휴", "lunar"),
    ("2026-09-25", "추석", "lunar"),
    ("2026-09-26", "추석 연휴", "lunar"),
    ("2026-10-03", "개천절", "public"),
    ("2026-10-05", "개천절 대체공휴일", "substitute"),
    ("2026-10-09", "한글날", "public"),
    ("2026-12-25", "성탄절", "public"),
]


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names():
        return
    existing = {r[0] for r in bind.execute(
        sa.text(f"SELECT date FROM {TABLE} WHERE date LIKE '2026-%'")).fetchall()}
    rows = [{"id": str(uuid.uuid4()), "date": d, "name": n, "kind": k, "active": True}
            for d, n, k in HOLIDAYS_2026 if d not in existing]
    if not rows:
        return
    t = sa.table(TABLE,
                 sa.column("id", sa.String), sa.column("date", sa.String),
                 sa.column("name", sa.String), sa.column("kind", sa.String),
                 sa.column("active", sa.Boolean))
    op.bulk_insert(t, rows)


def downgrade():
    bind = op.get_bind()
    if TABLE not in sa.inspect(bind).get_table_names():
        return
    dates = ", ".join(f"'{d}'" for d, _, _ in HOLIDAYS_2026)
    bind.execute(sa.text(f"DELETE FROM {TABLE} WHERE date IN ({dates}) AND kind IS NOT NULL"))
