"""체위변경 방송 시각을 07시부터 2시간 간격으로

Revision ID: bc26pos007g
Revises: bc26auto006f

이미 저장된 설정이 예전 기본값(짝수 시)이면 새 기본값(홀수 시)으로 옮긴다.
사람이 따로 고른 시각은 건드리지 않는다 — 골라 둔 것을 마음대로 바꾸면 안 된다.
"""
import json

from alembic import op
import sqlalchemy as sa

revision = "bc26pos007g"
down_revision = "bc26auto006f"
branch_labels = None
depends_on = None

OLD = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
NEW = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"]


def _shift(conn, frm, to):
    row = conn.execute(sa.text(
        "SELECT value FROM broadcast_auto_settings WHERE key = 'POSITION'")).fetchone()
    if not row or not row[0]:
        return                                   # 설정한 적이 없다 — 기본값이 그대로 쓰인다
    val = row[0] if isinstance(row[0], dict) else json.loads(row[0])
    if sorted(val.get("times") or []) != sorted(frm):
        return                                   # 사람이 고른 시각이다 — 두고 간다
    val["times"] = list(to)
    conn.execute(sa.text(
        "UPDATE broadcast_auto_settings SET value = :v WHERE key = 'POSITION'"),
        {"v": json.dumps(val, ensure_ascii=False)})


def upgrade() -> None:
    _shift(op.get_bind(), OLD, NEW)


def downgrade() -> None:
    _shift(op.get_bind(), NEW, OLD)
