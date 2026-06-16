"""add audit_rules and resident_leave_records

Revision ID: k2f3a4b5c6d7
Revises: k1l2m3n4o5p6
Create Date: 2026-06-16
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k2f3a4b5c6d7'
down_revision: Union[str, None] = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None

DEFAULT_RULE = """[CRITICAL] 절대 불가 항목
- 사망일 이후 서비스 기록
- 동일 시각 한 직원이 3명 이상 어르신에게 동시 서비스 기록
- 입소일 이전 기록, 퇴소일 이후 기록

[HIGH] 법적 필수 항목
- 서비스 날짜 공란 또는 미래 날짜 기록
- 작성자(종사자) 서명·성명 누락
- 필수 급여항목 누락: 식사도움, 기저귀교환, 체위변경, 이동도움, 프로그램명
- 특이사항 미기록 (낙상·발열·설사·응급상황·거부행동 발생 시)
- 급여계획 대비 실제 제공 불일치
- 외박·외출 기간 중 시설 내 서비스 기록 (외박/외출 정보와 대조)

[HIGH] 이상 패턴
- 동일 시각 3가지 이상 서비스 동시 기록
- 인력 근무시간 대비 서비스 제공 시간 초과
- 체위변경 2시간 간격 미준수 (와상 어르신)

[MEDIUM] 복붙·반복 패턴
- 5일 이상 동일 문장 95% 유사도 반복
- 7일 이상 반복 → HIGH 처리
- "식사 잘함", "특이사항 없음" 상투어 남발
- 프로그램명 없이 "프로그램 참여" 반복

[MEDIUM] 이상치
- 체위변경 25회 초과, 기저귀교환 15회 초과
- 동일 어르신 동일 서비스 같은 날 3회 이상

[LOW] 기록 품질
- "식사 잘함" → "점심 2/3공기 섭취" 수준 권고
- "특이사항 없음" → 구체적 관찰 내용 기재 권고"""


def _exists(conn, table: str) -> bool:
    r = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name=:t"
    ), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # ── audit_rules ───────────────────────────────────────────────────────
    if not _exists(conn, 'audit_rules'):
        op.create_table(
            'audit_rules',
            sa.Column('id',         sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('title',      sa.String(200), nullable=False),
            sa.Column('content',    sa.Text, nullable=False),
            sa.Column('is_active',  sa.Boolean, server_default=sa.text('true')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        )
        conn.execute(sa.text(
            "INSERT INTO audit_rules (title, content) VALUES (:t, :c)"
        ), {"t": "공단 평가 기준 기본 룰", "c": DEFAULT_RULE})

    # ── resident_leave_records ────────────────────────────────────────────
    if not _exists(conn, 'resident_leave_records'):
        op.create_table(
            'resident_leave_records',
            sa.Column('id',            sa.String, primary_key=True),
            sa.Column('resident_name', sa.String(100), nullable=False, index=True),
            sa.Column('leave_type',    sa.String(20), nullable=False),   # 외박|외출
            sa.Column('leave_date',    sa.String(20), nullable=False),
            sa.Column('return_date',   sa.String(20), nullable=True),
            sa.Column('reason',        sa.String(200), nullable=True),
            sa.Column('source_file',   sa.String(255), nullable=True),
            sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _exists(conn, 'resident_leave_records'):
        op.drop_table('resident_leave_records')
    if _exists(conn, 'audit_rules'):
        op.drop_table('audit_rules')
