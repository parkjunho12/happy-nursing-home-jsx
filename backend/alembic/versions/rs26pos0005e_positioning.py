"""수급자 체위변경 대상자 표시

Revision ID: rs26pos0005e
Revises: bc26cast004d
"""
from alembic import op
import sqlalchemy as sa

revision = "rs26pos0005e"
down_revision = "bc26cast004d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 체위변경 대상자(와상·욕창 위험) — 안내방송 대상 명단의 근거가 된다.
    # 기존 어르신은 모두 '아님'으로 시작한다. 사람이 보고 켠다.
    op.add_column("ltc_residents",
                  sa.Column("positioning", sa.Boolean(), nullable=True,
                            server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("ltc_residents", "positioning")
