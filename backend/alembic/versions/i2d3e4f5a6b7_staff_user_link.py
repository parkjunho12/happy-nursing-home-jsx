"""직원(ltc_staff_members) ↔ 로그인 계정(users) 명시 연동

Revision ID: i2d3e4f5a6b7
Revises: h1c2d3e4f5a6
"""
from alembic import op
import sqlalchemy as sa

revision = "i2d3e4f5a6b7"
down_revision = "h1c2d3e4f5a6"
branch_labels = None
depends_on = None

TABLE = "ltc_staff_members"


def upgrade():
    insp = sa.inspect(op.get_bind())
    if TABLE not in insp.get_table_names():
        return
    if "user_id" not in {c["name"] for c in insp.get_columns(TABLE)}:
        op.add_column(TABLE, sa.Column("user_id", sa.String(), nullable=True))
        op.create_index("ix_ltc_staff_members_user_id", TABLE, ["user_id"])


def downgrade():
    insp = sa.inspect(op.get_bind())
    if TABLE in insp.get_table_names() and \
       "user_id" in {c["name"] for c in insp.get_columns(TABLE)}:
        op.drop_index("ix_ltc_staff_members_user_id", TABLE)
        op.drop_column(TABLE, "user_id")
