"""월간 업무를 사람별로 — 주인(owner_id) 추가

Revision ID: rt26own013m
Revises: ot26pos012l

ADMIN 만 쓰던 화면을 전 직원에게 연다. 각자 자기 것만 보고 관리한다.
이미 있는 업무는 주인이 없으므로, 지금까지 쓰던 ADMIN 에게 넘긴다 —
그러지 않으면 열자마자 목록이 통째로 사라져 보인다.
"""
from alembic import op
import sqlalchemy as sa

revision = "rt26own013m"
down_revision = "ot26pos012l"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("admin_routines", sa.Column("owner_id", sa.String(), nullable=True))
    op.create_index("ix_admin_routines_owner_id", "admin_routines", ["owner_id"])

    conn = op.get_bind()
    n = conn.execute(sa.text("SELECT COUNT(*) FROM admin_routines")).scalar() or 0
    if n:
        # 가장 먼저 만들어진 ADMIN 계정에게 넘긴다 — 지금까지 이 화면을 쓰던 사람이다
        owner = conn.execute(sa.text(
            "SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at NULLS LAST, id LIMIT 1"
        )).scalar()
        if owner:
            conn.execute(sa.text("UPDATE admin_routines SET owner_id = :o WHERE owner_id IS NULL"),
                         {"o": owner})
    # 주인이 없는 업무는 아무에게도 안 보인다 — 남겨두지 않는다
    conn.execute(sa.text("DELETE FROM admin_routine_dones WHERE routine_id IN "
                         "(SELECT id FROM admin_routines WHERE owner_id IS NULL)"))
    conn.execute(sa.text("DELETE FROM admin_routines WHERE owner_id IS NULL"))
    op.alter_column("admin_routines", "owner_id", nullable=False)


def downgrade() -> None:
    op.drop_index("ix_admin_routines_owner_id", table_name="admin_routines")
    op.drop_column("admin_routines", "owner_id")
