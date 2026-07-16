"""옛 기본 공지 템플릿을 직원 대상 세트로 교체 (원본 그대로인 것만)

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-16

- 사용자가 수정하거나 직접 만든 템플릿은 건드리지 않는다.
- 원본 시드(name+title+content 일치)만 삭제 후, 새 직원용 기본값을 이름 중복 없이 추가.
"""
import uuid
from datetime import datetime, timezone, timedelta
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'e6f7a8b9c0d1'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None

KST = timezone(timedelta(hours=9))

# 최초 시드(보호자 혼재) — 원본 그대로일 때만 제거 대상
OLD_SEEDS = [
    ("정전 안내", "정전 안내",
     "○월 ○일(요일) ○시 ~ ○시, 시설 정전이 예정되어 있습니다.\n승강기·냉난방 이용에 참고 부탁드립니다. 문의: 031-856-8090"),
    ("면회 안내", "면회 안내",
     "면회는 매주 ○요일 ○시 ~ ○시에 가능합니다.\n방문 전 전화로 예약 부탁드립니다. 문의: 031-856-8090"),
    ("근무표 확정", "○월 근무표 확정 안내",
     "○월 근무표가 확정되었습니다. 직원앱에서 확인해 주세요.\n변경 요청은 ○월 ○일까지 팀장에게 전달 바랍니다."),
    ("행사 안내", "행사 안내",
     "○월 ○일(요일) ○시, ○○ 행사가 진행됩니다.\n어르신·보호자 여러분의 많은 관심과 참여 부탁드립니다."),
    ("긴급 안내", "긴급 안내",
     "긴급히 안내드립니다.\n○○○ 상황이 발생하였습니다. 자세한 내용은 담당자에게 즉시 문의 바랍니다."),
]

# 새 직원용 기본 템플릿
NEW_DEFAULTS = [
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
        return  # 테이블이 없으면 앞 마이그레이션이 새 세트로 시드함

    # 1) 원본 그대로인 옛 기본값만 삭제 (사용자 편집본은 보존)
    for name, title, content in OLD_SEEDS:
        bind.execute(
            sa.text(
                "DELETE FROM notice_templates "
                "WHERE name = :n AND title = :t AND content = :c"
            ),
            {"n": name, "t": title, "c": content},
        )

    # 2) 새 기본값 추가 — 같은 이름이 이미 있으면 건너뜀(중복 방지)
    now = datetime.now(KST)
    for i, (name, level, title, content) in enumerate(NEW_DEFAULTS):
        exists = bind.execute(
            sa.text("SELECT COUNT(*) FROM notice_templates WHERE name = :n"),
            {"n": name},
        ).scalar()
        if exists:
            continue
        bind.execute(
            sa.text(
                "INSERT INTO notice_templates "
                "(id, name, level, title, content, sort_order, created_at, updated_at) "
                "VALUES (:id, :name, :level, :title, :content, :so, :ca, :ua)"
            ),
            {"id": str(uuid.uuid4()), "name": name, "level": level, "title": title,
             "content": content, "so": i, "ca": now, "ua": now},
        )


def downgrade():
    # 시드 정리성 마이그레이션 — 되돌리지 않는다(사용자 데이터 보호).
    pass
