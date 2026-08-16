"""저장된 안내 문구를 새 기본 문구로 올린다

Revision ID: bc26tpl008h
Revises: bc26pos007g

기본 문구를 코드에서 바꿔도, 이미 한 번 저장한 곳에는 예전 문구가 그대로 남는다
(저장된 값이 기본값보다 우선하므로). 그래서 화면에는 계속 옛 문구가 보인다.

'예전 기본값 그대로인 것'만 새 문구로 올린다.
사람이 직접 고쳐 쓴 문구는 건드리지 않는다.
"""
import json

from alembic import op
import sqlalchemy as sa

revision = "bc26tpl008h"
down_revision = "bc26pos007g"
branch_labels = None
depends_on = None

POS_OLD = ("안내 말씀드립니다. 지금은 체위변경 시간입니다. "
           "대상 어르신은 {names} 어르신입니다. "
           "담당 선생님들께서는 체위변경을 실시해 주시기 바랍니다. 감사합니다.")
POS_NEW = ("선생님들께 안내드립니다. 지금은 어르신 체위변경 시간입니다. "
           "대상 어르신은 {names} 어르신입니다. "
           "담당 어르신의 자세와 피부 상태를 확인하시고, "
           "안전하게 체위변경을 진행해 주시기 바랍니다. "
           "어르신 한 분 한 분 세심하게 살펴주시고, "
           "필요한 사항은 빠짐없이 확인 부탁드립니다. 감사합니다.")

PRG_OLD = ("안내 말씀드립니다. 잠시 후 {time}부터 {title} 프로그램을 시작합니다. "
           "{who} 프로그램실로 와 주시기 바랍니다.")
PRG_NEW = ("안내 말씀드립니다. 잠시 후 {time}부터 {title} 프로그램이 시작됩니다. "
           "담당 선생님들께서는 {who} 프로그램실로 모셔 주시기 바랍니다. 감사합니다.")


def _load(raw):
    if raw is None:
        return None
    return raw if isinstance(raw, dict) else json.loads(raw)


def _swap_position(conn, frm, to):
    row = conn.execute(sa.text(
        "SELECT value FROM broadcast_auto_settings WHERE key = 'POSITION'")).fetchone()
    val = _load(row[0]) if row else None
    if not val or (val.get("template") or "").strip() != frm:
        return
    val["template"] = to
    conn.execute(sa.text(
        "UPDATE broadcast_auto_settings SET value = :v WHERE key = 'POSITION'"),
        {"v": json.dumps(val, ensure_ascii=False)})


def _swap_program(conn, frm, to):
    for pk, raw in conn.execute(sa.text(
            "SELECT id, broadcast FROM program_settings")).fetchall():
        val = _load(raw)
        if not val or (val.get("template") or "").strip() != frm:
            continue
        val["template"] = to
        conn.execute(sa.text("UPDATE program_settings SET broadcast = :v WHERE id = :i"),
                     {"v": json.dumps(val, ensure_ascii=False), "i": pk})


def upgrade() -> None:
    conn = op.get_bind()
    _swap_position(conn, POS_OLD, POS_NEW)
    _swap_program(conn, PRG_OLD, PRG_NEW)


def downgrade() -> None:
    conn = op.get_bind()
    _swap_position(conn, POS_NEW, POS_OLD)
    _swap_program(conn, PRG_NEW, PRG_OLD)
