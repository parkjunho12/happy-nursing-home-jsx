"""resident_doc_status: care_type(구분) + followup_date(다음 확인일)

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
"""
from alembic import op
import sqlalchemy as sa

revision = "a4b5c6d7e8f9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None

TABLE = "resident_doc_status"


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(TABLE)}
    if "care_type" not in cols:
        op.add_column(TABLE, sa.Column("care_type", sa.String(length=20), nullable=True))
        # 기존 어르신은 모두 시설(재원)로 간주
        op.execute(f"UPDATE {TABLE} SET care_type = '시설' WHERE care_type IS NULL")
    if "followup_date" not in cols:
        op.add_column(TABLE, sa.Column("followup_date", sa.String(length=20), nullable=True))


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(TABLE)}
    if "followup_date" in cols:
        op.drop_column(TABLE, "followup_date")
    if "care_type" in cols:
        op.drop_column(TABLE, "care_type")
