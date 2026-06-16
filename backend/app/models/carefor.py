"""
케어포 연동 데이터 모델
- CareforResident: 수급자 정보
- CareforLeaveRecord: 외출·외박 기록
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import Column, String, Text, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


class CareforResident(Base):
    __tablename__ = "carefor_residents"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resident_code = Column(String, nullable=True, index=True)
    name          = Column(String, nullable=False, index=True)
    birth_date    = Column(String, nullable=True)
    gender        = Column(String, nullable=True)
    care_grade    = Column(String, nullable=True)
    admission_date = Column(String, nullable=True)
    discharge_date = Column(String, nullable=True)
    room_name     = Column(String, nullable=True)
    status        = Column(String, default="active", index=True)
    raw_data      = Column(JSON, nullable=True)   # 원본 행 (개인정보 마스킹 후)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class CareforLeaveRecord(Base):
    __tablename__ = "carefor_leave_records"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resident_id    = Column(String, nullable=True, index=True)   # carefor_residents.id FK (soft)
    resident_name  = Column(String, nullable=False, index=True)
    resident_code  = Column(String, nullable=True, index=True)

    leave_type  = Column(String, nullable=True)   # 외출|외박|병원외출|기타
    start_date  = Column(String, nullable=True, index=True)
    start_time  = Column(String, nullable=True)
    end_date    = Column(String, nullable=True, index=True)
    end_time    = Column(String, nullable=True)
    reason      = Column(Text, nullable=True)
    guardian_name = Column(String, nullable=True)
    memo        = Column(Text, nullable=True)
    raw_data    = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class StaffWorkSchedule(Base):
    __tablename__ = "staff_work_schedules"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    staff_name  = Column(String, nullable=False, index=True)
    user_id     = Column(String, nullable=True,  index=True)   # users.id (soft FK)
    position    = Column(String, nullable=True)                # 직종
    team        = Column(String, nullable=True)                # 조 (A조/B조 등)

    work_date   = Column(String, nullable=False, index=True)   # YYYY-MM-DD
    shift_code  = Column(String, nullable=True)                # D / N / E / 휴 등
    shift_label = Column(String, nullable=True)                # 주간 / 야간 / 이브닝 / 휴무
    start_time  = Column(String, nullable=True)                # HH:MM
    end_time    = Column(String, nullable=True)                # HH:MM

    is_working  = Column(Boolean, default=True, index=True)

    raw_data    = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
