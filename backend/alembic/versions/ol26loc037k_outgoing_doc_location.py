"""내보낼 문서가 지금 어디 있는지.

이게 없으면 교부하려고 꺼낼 때마다 "그거 어디 뒀지" 를 사람에게 묻는다.
서류는 대개 현관 앞에 모아 두므로 기본값을 '1층 현관' 으로 두고 고칠 수
있게 한다 — 매번 적게 하면 비워 두게 되고, 비면 없느니만 못하다.

이미 들어 있는 줄에도 같은 기본값을 채운다. 빈 채로 두면 예전 줄만
'위치 모름' 으로 남아 오히려 눈에 걸린다.

Revision ID: ol26loc037k
Revises: od26doc036j
"""
from alembic import op
import sqlalchemy as sa


revision = "ol26loc037k"
down_revision = "od26doc036j"
branch_labels = None
depends_on = None

DEFAULT_LOCATION = "1층 현관"


def upgrade() -> None:
    op.add_column("outgoing_docs", sa.Column("location", sa.String(length=100), nullable=True))
    # 이미 있는 줄도 같은 기본값으로
    op.execute(f"UPDATE outgoing_docs SET location = '{DEFAULT_LOCATION}' WHERE location IS NULL")


def downgrade() -> None:
    op.drop_column("outgoing_docs", "location")
