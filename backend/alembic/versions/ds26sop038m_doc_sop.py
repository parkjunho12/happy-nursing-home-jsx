"""갱신 서류 처리 순서 — 고칠 수 있게 + 이력.

이 순서는 코드에 박혀 있었다. 그런데 실제로는 바뀐다 — 복지톡이 다른 것으로
바뀌거나, 공단 절차가 달라지거나, 원본을 두는 자리가 바뀐다. 그때마다 배포를
기다려야 하면 결국 종이에 따로 적어 붙이게 되고 화면의 것은 틀린 채로 남는다.

여러 사람이 그대로 따라 하는 절차라 이력을 함께 남긴다. 어느 날 한 줄이
사라졌는데 누가 왜 지웠는지 모르면 빠뜨린 것인지 일부러 뺀 것인지 알 수 없다.

지금 화면에 박혀 있는 글을 그대로 초기값으로 넣는다 — 비워 두면 이 기능이
켜지는 순간 안내가 사라진다.

Revision ID: ds26sop038m
Revises: ol26loc037k
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column


revision = "ds26sop038m"
down_revision = "ol26loc037k"
branch_labels = None
depends_on = None

SOP = """▶ 서류(인정서, 개장기) 사진찍어 복지톡에 업로드
▶ 보호자께 갱신 서류 도착 문자 알림
▶ 서류 복사 후 복사본은 어르신 개인 파일에 철하기
▶ 원본은 출입구 앞 파일에 넣기(보호자 오시면 드리기)
▶ 계약서 준비 후 출입구 앞 파일에(내용 전부 미리 작성, 보호자 서명만)
▶ 케어포 등급 및 본인부담률 수정 / 구글 현황표 수정
* 갱신기준일자에 맞춰 급여제공계획서 작성 후 보호자 서명받아 철하기
* 갱신기준일자에 맞춰 급여제공평가 등 각종 평가 작성
* 국민건강보험공단에 갱신 등록"""

SMS = ("안녕하세요. 행복한요양원 복지팀 000입니다. "
       "어르신 인정서 갱신서류가 우편으로 도착했습니다. "
       "원 방문 시 계약 서류 작성 부탁드립니다 ^^")


def upgrade() -> None:
    op.create_table(
        "doc_sops",
        sa.Column("key", sa.String(length=40), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "doc_sop_histories",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("length", sa.Integer(), nullable=True),
        sa.Column("changed_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_doc_sop_hist_key", "doc_sop_histories", ["key", "created_at"])

    # 지금 화면에 있는 글을 그대로 넣는다 — 비면 안내가 사라진다
    t = table("doc_sops", column("key", sa.String), column("content", sa.Text))
    op.bulk_insert(t, [
        {"key": "renewal_sop", "content": SOP},
        {"key": "renewal_sms", "content": SMS},
    ])


def downgrade() -> None:
    op.drop_table("doc_sop_histories")
    op.drop_table("doc_sops")
