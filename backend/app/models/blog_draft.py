"""블로그 초안 — 관리자 화면에서 검토하고, 네이버에는 사람이 붙여넣는다.

■ 왜 발행 연동을 두지 않는가

  네이버는 공식 글쓰기 API 를 열어두지 않았다. 로그인 자동화로 흉내 내는
  방법은 있지만 그건 우회다. 그래서 여기까지만 한다 — 초안을 잘 만들어
  보여주고, 본문 복사와 번호 붙은 사진 묶음을 준다. 붙여넣는 것은 사람이
  한다. 대신 붙여넣기가 편하도록 사진 순서와 번호를 본문과 맞춰 둔다.

■ 표 셋

  BlogPhotoUse   사진 한 장의 '쓸 수 있는가' 와 '가려진 파생본'
  BlogDraft      초안 한 편 (블록 배열 + 중복 검사 결과 + 비용)
  BlogHistory    이미 발행된 글 (중복 검사의 기준)

■ 동의는 별도로 확인한다

  보호자 앨범에 올라간 것은 '보호자가 볼 수 있다' 는 뜻이지 '공개 홍보에
  써도 된다' 는 뜻이 아니다. 시스템 어디에도 그 구분이 없어서 표를 새로
  둔다. 확인하지 않은 사진은 자동 후보에 오르지 않는다 — 얼굴을 가렸다는
  이유로 써도 된다고 처리하지 않는다.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, JSON, Index, UniqueConstraint,
)

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


# 상태 값과 '나가도 되는가' 판단은 blog_gate 에 있다 — 배포 전 검사에서
# 라이브러리 설치 없이 부를 수 있어야 해서다. 여기서는 그대로 다시 내보낸다.
from app.services.blog_gate import (  # noqa: E402,F401
    USE_UNKNOWN, USE_ALLOWED, USE_DENIED,
    MASK_NONE, MASK_MASKED, MASK_NO_FACE, MASK_FAILED,
    photo_usable,
)


class BlogPhotoUse(Base):
    """사진 한 장에 대한 판단과 파생본.

    원본은 절대 덮어쓰지 않는다. 가린 그림은 별도 주소에 따로 둔다.
    """

    __tablename__ = "blog_photo_uses"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_blog_photo_source"),
        Index("ix_blog_photo_state", "publicity", "mask_status"),
    )

    id         = Column(String, primary_key=True, default=_uuid)
    source     = Column(String(20), nullable=False)     # program | album
    source_id  = Column(String, nullable=False)
    origin_url = Column(String(500), nullable=False)    # 원본 (외부로 내보내지 않는다)

    # 같은 사진인지 가리는 근거. 스티커 위치를 바꿔도 원본 해시는 같다.
    origin_sha256 = Column(String(64), nullable=True, index=True)

    publicity      = Column(String(10), nullable=False, default=USE_UNKNOWN)
    publicity_by   = Column(String(100), nullable=True)
    publicity_at   = Column(DateTime(timezone=True), nullable=True)
    publicity_note = Column(String(200), nullable=True)

    mask_status = Column(String(10), nullable=False, default=MASK_NONE)
    mask_url    = Column(String(500), nullable=True)     # 가린 파생본
    mask_boxes  = Column(JSON, nullable=True)            # [{x,y,w,h,source,score}]
    mask_detector = Column(String(30), nullable=True)
    mask_reason = Column(String(200), nullable=True)
    mask_at     = Column(DateTime(timezone=True), nullable=True)
    # 사람이 눈으로 확인했는가. 자동 검출만으로는 후보가 되지 않는다.
    mask_reviewed_by = Column(String(100), nullable=True)
    mask_reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # 사생활 우려가 큰 장면(식사·목욕·처치 등)으로 표시된 사진
    sensitive = Column(Boolean, nullable=False, default=False)

    width  = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    taken_on = Column(String(10), nullable=True)         # 'YYYY-MM-DD'
    program_title = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)

    @property
    def usable(self) -> bool:
        """초안에 넣어도 되는 사진인가 — 판단은 blog_gate 한 곳에만 둔다."""
        return photo_usable(self.publicity, self.mask_status,
                            bool(self.mask_reviewed_at), bool(self.sensitive))


class BlogDraft(Base):
    """초안 한 편."""

    __tablename__ = "blog_drafts"
    __table_args__ = (
        Index("ix_blog_draft_state", "status", "created_at"),
        # 같은 예약 회차가 두 번 돌지 않게 — 재시도로 초안이 둘 생기는 것을 막는다
        UniqueConstraint("run_key", name="uq_blog_draft_run"),
    )

    id      = Column(String, primary_key=True, default=_uuid)
    run_key = Column(String(40), nullable=True)          # 'auto-2026-09-08' 같은 회차 표식

    status  = Column(String(20), nullable=False, default="draft")
    # draft(검토 대기) | approved(검토 완료) | held(보류) | failed

    title      = Column(String(200), nullable=True)
    title_alts = Column(JSON, nullable=True)             # 제목 후보 3개
    blocks     = Column(JSON, nullable=True)             # 순서 있는 콘텐츠 블록
    hashtags   = Column(JSON, nullable=True)
    topic      = Column(String(60), nullable=True)       # 신체활동·인지활동 …
    activity_dates = Column(JSON, nullable=True)         # ['2026-09-01', …]
    source_note = Column(Text, nullable=True)            # 어떤 기록을 근거로 썼는가

    dup_status = Column(String(24), nullable=False, default="unknown")
    # pass(통과) | review(검토 필요) | incomplete(이력 확인 불완전)
    dup_report = Column(JSON, nullable=True)             # 유사 글·겹치는 문장·사진 재사용

    # 비용 — 확인 못 한 항목은 0 이 아니라 null 로 둔다
    model         = Column(String(40), nullable=True)
    input_tokens  = Column(Integer, nullable=True)
    cached_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    reasoning_tokens = Column(Integer, nullable=True)    # output_tokens 안에 포함된 값
    cost_usd      = Column(Float, nullable=True)
    attempts      = Column(Integer, nullable=False, default=0)

    hold_reason = Column(String(300), nullable=True)
    created_by  = Column(String(100), nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    # 검토 완료 뒤 내용이 바뀌면 다시 검토하도록 이 값을 비운다
    content_rev = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=now_kst, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class BlogHistory(Base):
    """이미 발행된 글 — 중복 검사의 기준.

    자동으로 못 가져오는 글은 관리자가 주소와 본문을 붙여 등록한다.
    확보하지 못한 글까지 검사를 마쳤다고 말하지 않기 위해, 어디까지
    모았는지(collected_by)를 함께 남긴다.
    """

    __tablename__ = "blog_histories"
    __table_args__ = (
        UniqueConstraint("log_no", name="uq_blog_history_logno"),
        Index("ix_blog_history_date", "published_on"),
    )

    id      = Column(String, primary_key=True, default=_uuid)
    log_no  = Column(String(40), nullable=False)         # 네이버 글 번호
    url     = Column(String(500), nullable=False)
    title   = Column(String(300), nullable=True)
    body    = Column(Text, nullable=True)
    published_on = Column(String(10), nullable=True)     # 발행일
    # 실제 활동일 — 확인되는 경우에만. 발행일로 짐작해 채우지 않는다.
    activity_on  = Column(String(10), nullable=True)
    topic        = Column(String(60), nullable=True)
    program_name = Column(String(200), nullable=True)
    highlights   = Column(JSON, nullable=True)           # 그 글이 강조한 것
    summary      = Column(Text, nullable=True)
    photo_refs   = Column(JSON, nullable=True)           # 사진 주소·해시
    collected_by = Column(String(20), nullable=False, default="manual")  # fetch | manual
    created_at   = Column(DateTime(timezone=True), default=now_kst)
