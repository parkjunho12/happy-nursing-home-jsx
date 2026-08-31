"""직원 메모에 적어 두신 아이디·비밀번호를 계정에 옮긴다.

■ 왜 마이그레이션인가

  아이디와 네 자리 비밀번호가 이미 직원 관리 메모칸에 'H010/8090' 형태로
  적혀 있다. 선생님들이 그 번호로 알고 계시므로 그대로 써야 한다.

  이 값들은 이미 서버 DB 안에 있다. 그래서 여기서 읽어 옮긴다 —
  평문이 소스코드나 커밋에 한 번도 남지 않는다. 이 저장소는 공개다.

■ 조심한 것

  · 메모에서 '영문+숫자 / 네자리숫자' 모양만 읽는다. 메모에는 '간호팀장'
    처럼 직종만 적힌 줄도 있고, 그건 아이디가 아니다.
  · 계정을 못 찾으면 건너뛴다. 이름이 겹치면 누구인지 확신할 수 없으므로
    역시 건너뛴다 — 엉뚱한 사람의 비밀번호를 바꾸는 것이 최악이다.
  · 이미 다른 사람이 쓰는 아이디면 건너뛴다.
  · 비밀번호는 메모에 네 자리가 있을 때만 바꾼다. 아이디만 적혀 있으면
    아이디만 넣고 비밀번호는 건드리지 않는다.
  · 로그에 비밀번호를 적지 않는다. 몇 건 처리했는지만 남긴다.

■ 이 뒤에 하실 일

  메모칸의 비밀번호는 지우시는 게 좋다. 직원 관리 화면을 볼 수 있는 사람은
  누구나 전 직원의 비밀번호를 읽을 수 있는 상태다. 이 마이그레이션은
  메모를 건드리지 않는다 — 지우는 것은 사람이 확인하고 할 일이다.

Revision ID: au26memo024x
Revises: au26login023w
"""
import logging
import re

from alembic import op
import sqlalchemy as sa


revision = "au26memo024x"
down_revision = "au26login023w"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")

# 'H010/8090', 'H026 / 0856', 'H20/8090' — 앞은 아이디, 뒤는 네 자리
PAIR = re.compile(r"\b([A-Za-z][A-Za-z0-9_-]{2,19})\s*/\s*(\d{4})\b")
# 비밀번호 없이 아이디만 적힌 경우
ONLY_ID = re.compile(r"\b([A-Za-z]\d{2,5})\b")


def _hash(pw: str) -> str:
    from passlib.context import CryptContext
    return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(pw)


def upgrade() -> None:
    conn = op.get_bind()

    staff = conn.execute(sa.text(
        "SELECT id, user_id, name, memo FROM ltc_staff_members "
        "WHERE memo IS NOT NULL AND memo <> ''")).fetchall()

    taken = {r[0].upper() for r in conn.execute(sa.text(
        "SELECT login_id FROM users WHERE login_id IS NOT NULL")).fetchall()}

    done_id = done_pw = 0
    skipped: list = []

    for st in staff:
        memo = st.memo or ""
        m = PAIR.search(memo)
        if m:
            login_id, pw = m.group(1).upper(), m.group(2)
        else:
            m2 = ONLY_ID.search(memo)
            if not m2:
                continue                     # 아이디가 안 적힌 줄 — 건너뛴다
            login_id, pw = m2.group(1).upper(), None

        # 계정 찾기 — 명시 연동이 우선, 없으면 이름
        uid = st.user_id
        if not uid:
            rows = conn.execute(sa.text("SELECT id FROM users WHERE name = :n"),
                                {"n": st.name}).fetchall()
            if len(rows) != 1:
                # 0명이면 계정이 없는 것, 2명 이상이면 누구인지 알 수 없다
                skipped.append(f"{st.name}(계정 {len(rows)}개)")
                continue
            uid = rows[0][0]

        if login_id in taken:
            cur = conn.execute(sa.text("SELECT login_id FROM users WHERE id = :i"),
                               {"i": uid}).scalar()
            if (cur or "").upper() != login_id:
                skipped.append(f"{st.name}(아이디 중복)")
                continue

        conn.execute(sa.text("UPDATE users SET login_id = :l WHERE id = :i"),
                     {"l": login_id, "i": uid})
        taken.add(login_id)
        done_id += 1

        if pw:
            conn.execute(sa.text("UPDATE users SET hashed_password = :h WHERE id = :i"),
                         {"h": _hash(pw), "i": uid})
            done_pw += 1

    logger.info("메모에서 아이디 %d건, 비밀번호 %d건 반영", done_id, done_pw)
    if skipped:
        logger.warning("건너뜀 %d건: %s", len(skipped), ", ".join(skipped[:20]))


def downgrade() -> None:
    # 되돌리지 않는다. 비밀번호는 원래 값을 알 수 없고(해시라 복원 불가),
    # 아이디는 위 마이그레이션(au26login023w)을 내리면 컬럼째 사라진다.
    pass
