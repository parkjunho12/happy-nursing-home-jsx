"""직원 법정·평가 의무교육 계획 및 실시 기록."""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text

from app.core.database import Base

KST = timezone(timedelta(hours=9))


def _uuid() -> str:
    return str(uuid.uuid4())


def now_kst() -> datetime:
    return datetime.now(KST)


class StaffEducation(Base):
    """연간 직원교육 계획 1건 = 1행. 실시하면 같은 행에 기록을 남긴다."""
    __tablename__ = "staff_educations"

    id = Column(String, primary_key=True, default=_uuid)

    # ── 계획 (연초에 세팅)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)      # 1~12
    division = Column(String, nullable=False, default="기타")  # 평가 · 법정 · 기타
    eval_no = Column(String, nullable=True)                   # '평가19번' 등 원문
    topic = Column(String, nullable=True)                     # 분류 (노인인권보호지침 등)
    title = Column(String, nullable=False)                    # 교육명
    org = Column(String, nullable=True)                       # 교육기관 (자체-복지, GSEEK, KOHI, 외부교육)
    requirement = Column(Text, nullable=True)                 # 필수 기록사항 (사진/서명 요건)
    sort = Column(Integer, default=0)

    # ── 실시 기록
    done = Column(Boolean, default=False, index=True)
    plan_date = Column(String, nullable=True)                 # 예정일 YYYY-MM-DD
    done_date = Column(String, nullable=True)                 # 실시일 YYYY-MM-DD
    instructor = Column(String, nullable=True)                # 교육자
    attendee_count = Column(Integer, nullable=True)           # 참석 인원
    attendees = Column(Text, nullable=True)                   # 참석자 명단
    material = Column(Text, nullable=True)                    # 교육자료 · 사진 보관 위치/링크
    memo = Column(Text, nullable=True)

    active = Column(Boolean, default=True)
    updated_by_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
