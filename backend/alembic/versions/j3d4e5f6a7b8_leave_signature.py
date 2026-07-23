"""연차 신청 전자서명 (leave_requests.signature_url)

Revision ID: j3d4e5f6a7b8
Revises: i2d3e4f5a6b7
"""
from alembic import op
import sqlalchemy as sa

revision = "j3d4e5f6a7b8"
down_revision = "i2d3e4f5a6b7"
branch_labels = None
depends_on = None

TABLE = "leave_requests"


def upgrade():
    insp = sa.inspect(op.get_bind())
    if TABLE not in insp.get_table_names():
        return
    if "signature_url" not in {c["name"] for c in insp.get_columns(TABLE)}:
        op.add_column(TABLE, sa.Column("signature_url", sa.Text(), nullable=True))


def downgrade():
    insp = sa.inspect(op.get_bind())
    if TABLE in insp.get_table_names() and \
       "signature_url" in {c["name"] for c in insp.get_columns(TABLE)}:
        op.drop_column(TABLE, "signature_url")
