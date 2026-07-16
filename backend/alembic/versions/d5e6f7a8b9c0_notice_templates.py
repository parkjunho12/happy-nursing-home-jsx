"""notice_templates table + default seeds (공지 작성 템플릿)

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-16
"""
import uuid
from datetime import datetime, timezone, timedelta
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None

KST = timezone(timedelta(hours=9))

DEFAULTS = [
    ("근무표 확정", "info", "○월 근무표 확정 안내",
     "○월 근무표가 확정되었습니다. 직원앱에서 확인해 주세요.\n변경·조정 요청은 ○월 ○일까지 요양팀장에게 전달 바랍니다."),
    ("직원회의 안내", "info", "○월 직원회의 안내",
     "○월 ○일(요일) ○시, ○층 프로그램실에서 직원회의를 진행합니다.\n안건: ○○○.\n부득이 불참 시 사전에 팀장에게 알려주세요."),
    ("의무교육 안내", "important", "법정의무교육 이수 안내",
     "○○교육(성희롱예방·개인정보보호·감염관리·안전 등)을 ○월 ○일까지 이수해야 합니다.\n이수 후 담당자에게 확인 부탁드리며, 미이수자는 개별 안내됩니다."),
    ("감염관리 지침", "important", "감염관리·방역 지침 안내",
     "○○(코로나·독감 등) 관련 방역을 강화합니다.\n마스크 착용·손위생·발열 체크를 준수하고, 유증상(발열·기침 등) 발생 시 즉시 보고 바랍니다."),
    ("소방·대피훈련", "important", "소방 안전점검·대피훈련 안내",
     "○월 ○일(요일) ○시, 소방 대피훈련을 실시합니다.\n담당 구역별 대피 유도 절차를 숙지하고 전 직원 참여 바랍니다."),
    ("근무(당직) 변경", "info", "근무(당직) 변경 안내",
     "○월 ○일 ○○ 근무가 ○○○ 선생님으로 변경되었습니다.\n관련 인수인계 사항을 확인해 주세요."),
    ("경조사 안내", "info", "경조사 안내",
     "○○○ 선생님의 ○○ 소식을 전합니다.\n일시: ○월 ○일 / 장소: ○○○.\n마음 전하실 분은 참고 바랍니다."),
    ("긴급 안내", "urgent", "긴급 안내",
     "긴급히 공유드립니다.\n○○○ 상황이 발생했습니다. 담당자는 즉시 ○○ 조치 후 시설장에게 보고 바랍니다."),
]


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "notice_templates" not in insp.get_table_names():
        op.create_table(
            "notice_templates",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("level", sa.String(length=20), nullable=True, server_default="info"),
            sa.Column("title", sa.String(length=200), nullable=True),
            sa.Column("content", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_notice_templates_sort_order", "notice_templates", ["sort_order"])

    # 비어 있을 때만 기본 템플릿 시드
    count = bind.execute(sa.text("SELECT COUNT(*) FROM notice_templates")).scalar()
    if not count:
        now = datetime.now(KST)
        rows = [{
            "id": str(uuid.uuid4()), "name": nm, "level": lv, "title": ti, "content": ct,
            "sort_order": i, "created_at": now, "updated_at": now,
        } for i, (nm, lv, ti, ct) in enumerate(DEFAULTS)]
        tbl = sa.table(
            "notice_templates",
            sa.column("id", sa.String), sa.column("name", sa.String),
            sa.column("level", sa.String), sa.column("title", sa.String),
            sa.column("content", sa.Text), sa.column("sort_order", sa.Integer),
            sa.column("created_at", sa.DateTime), sa.column("updated_at", sa.DateTime),
        )
        op.bulk_insert(tbl, rows)


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "notice_templates" in insp.get_table_names():
        try:
            op.drop_index("ix_notice_templates_sort_order", table_name="notice_templates")
        except Exception:
            pass
        op.drop_table("notice_templates")
