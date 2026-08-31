"""로그인 아이디 — 이메일 대신 H001 같은 짧은 아이디로 들어올 수 있게.

왜: 요양보호사 선생님들이 휴대폰에서 hong1234@naver.com 을 매번 치고 계셨다.
아이디는 관리자가 한 명씩 지정한다(자동 부여하지 않는다 — 이미 쓰던 번호가
있고, 그 번호를 그대로 써야 한다).

이메일 로그인은 당분간 함께 남긴다. 전환 중에 아이디를 못 받았거나 잊은
분이 못 들어오면 그날 근무 기록이 밀린다.

  · nullable — 아직 지정 안 한 계정이 있어도 로그인은 이메일로 된다
  · unique  — 두 사람이 같은 아이디면 누가 들어왔는지 알 수 없다
  · 대소문자: 애플리케이션에서 대문자로 맞춰 넣는다(h001 로 쳐도 들어오게)

Revision ID: au26login023w
Revises: ws26sep022v
"""
from alembic import op
import sqlalchemy as sa


revision = "au26login023w"
down_revision = "ws26sep022v"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("login_id", sa.String(length=20), nullable=True))
    op.create_index("ix_users_login_id", "users", ["login_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_login_id", table_name="users")
    op.drop_column("users", "login_id")
