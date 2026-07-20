"""resident_doc_changes (어르신 서류 수정 이력)

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
"""
from alembic import op
import sqlalchemy as sa

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None

TABLE = "resident_doc_changes"


def upgrade():
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("doc_id", sa.String(), nullable=False, index=True),
        sa.Column("resident_name", sa.String(length=100), nullable=True),
        sa.Column("action", sa.String(length=20), nullable=True),
        sa.Column("changes", sa.JSON(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True, index=True),
        sa.Column("user_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, index=True),
    )


def downgrade():
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        op.drop_table(TABLE)
