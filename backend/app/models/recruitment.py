"""채용 (recruitment) — 공고 + 지원 (MVP, 개인정보 최소 수집, 이력서 파일 미보관)"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


def _uuid() -> str:
    return str(uuid.uuid4())


class RecruitmentPost(Base):
    """채용 공고 (관리자 등록)"""
    __tablename__ = "recruitment_posts"

    id              = Column(String, primary_key=True, default=_uuid)
    title           = Column(String, nullable=False)               # 공고 제목
    category        = Column(String, nullable=True)                # 요양보호사/사회복지사/간호조무사/시설장 ...
    employment_type = Column(String, nullable=True)                # 정규직/계약직/시간제
    work_time       = Column(String, nullable=True)                # 근무시간
    salary          = Column(String, nullable=True)                # 급여(선택)
    description     = Column(Text, nullable=True)                  # 간단한 소개
    status          = Column(String, default="모집중", nullable=False)  # 모집중/마감
    is_public       = Column(Boolean, default=True, nullable=False)     # 공개/비공개
    sort_order      = Column(Integer, default=0, nullable=False)
    created_at      = Column(DateTime(timezone=True), default=now_kst)
    updated_at      = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class RecruitmentApplication(Base):
    """채용 지원서 (이력서는 지원자가 별도 이메일로 전송 — 파일 미보관)"""
    __tablename__ = "recruitment_applications"

    id                 = Column(String, primary_key=True, default=_uuid)
    recruitment_post_id = Column(String, nullable=True)   # 선택한 공고(있으면)
    category           = Column(String, nullable=True)    # 지원 분야
    name               = Column(String, nullable=False)
    birth              = Column(String, nullable=True)     # 생년월일
    phone              = Column(String, nullable=False)
    email              = Column(String, nullable=True)
    experience         = Column(Text, nullable=True)       # 경력
    introduction       = Column(Text, nullable=True)       # 자기소개
    resume_file        = Column(String, nullable=True)     # (미사용/향후) 이력서는 이메일 수신
    privacy_agreed     = Column(Boolean, default=False, nullable=False)
    status             = Column(String, default="접수", nullable=False)  # 접수/검토중/면접예정/합격/불합격
    admin_memo         = Column(Text, nullable=True)
    created_at         = Column(DateTime(timezone=True), default=now_kst)
    updated_at         = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
