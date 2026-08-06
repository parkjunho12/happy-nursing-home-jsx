from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid


from app.core.database import Base


class FrequencyEnum(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    half_yearly = "half-yearly"
    yearly = "yearly"
    weekly_dow = "weekly_dow"            # 매주 특정 요일
    monthly_day = "monthly_day"          # 매월 생성일 + 기한일
    monthly_nth_dow = "monthly_nth_dow"  # 매월 N째 주 특정 요일
    on_admission = "on_admission"
    on_discharge = "on_discharge"
    on_hire = "on_hire"
    on_resign = "on_resign"


class RiskEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PersonTypeEnum(str, enum.Enum):
    resident = "resident"
    staff = "staff"
    facility = "facility"


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"


class EvalDomain(Base):
    __tablename__ = "eval_domains"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    color = Column(String(30), default="blue")
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)

    categories = relationship(
        "EvalCategory",
        back_populates="domain",
        cascade="all, delete-orphan",
        order_by="EvalCategory.sort_order",
    )


class EvalCategory(Base):
    __tablename__ = "eval_categories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    domain_id = Column(
        String,
        ForeignKey("eval_domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    question_count = Column(Integer, default=0)
    total_score = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)

    domain = relationship(
        "EvalDomain",
        back_populates="categories",
    )

    indicators = relationship(
        "EvalSubIndicator",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="EvalSubIndicator.sort_order",
    )


class EvalSubIndicator(Base):
    __tablename__ = "eval_sub_indicators"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id = Column(
        String,
        ForeignKey("eval_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    score = Column(Integer, default=0)
    criteria = Column(Text, default="")
    evidence_list = Column(Text, default="[]")
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)

    category = relationship(
        "EvalCategory",
        back_populates="indicators",
    )

    checklists = relationship(
        "ChecklistItem",
        back_populates="indicator",
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    frequency = Column(String(30), nullable=False)

    related_indicator_id = Column(
        String,
        ForeignKey("eval_sub_indicators.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    related_category_id = Column(
        String,
        ForeignKey("eval_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    related_domain_id = Column(
        String,
        ForeignKey("eval_domains.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    assignee         = Column(String(100), default="")
    assigned_user_id = Column(String, nullable=True, index=True)  # users.id FK

    # 반복 주기 세부 설정 (해당 frequency에서만 사용, 그 외엔 None)
    recur_weekday       = Column(Integer, nullable=True)  # 0=일..6=토 (weekly_dow / monthly_nth_dow)
    recur_week_of_month = Column(Integer, nullable=True)  # 1~5 (5=마지막 주) (monthly_nth_dow)
    recur_day           = Column(Integer, nullable=True)  # 1~31 생성일 (monthly_day)
    recur_due_day       = Column(Integer, nullable=True)  # 1~31 기한일 (monthly_day)
    due_date            = Column(String(20), nullable=True)  # one_time 기한 날짜(YYYY-MM-DD)
    evidence_required = Column(Text, default="")
    storage_location = Column(String(200), default="")
    how_to = Column(Text, default="")
    eval_note = Column(Text, default="")
    risk_level = Column(String(20), default="medium")
    active = Column(Boolean, default=True)
    memo = Column(Text, default="")
    attachment_name = Column(String(200), default="")

    completed = Column(Boolean, default=False)
    completed_date = Column(String(20), nullable=True)
    last_checked_date = Column(String(20), nullable=True)

    person_id = Column(String, nullable=True, index=True)
    person_name = Column(String(100), nullable=True)
    person_type = Column(String(20), nullable=True)
    template_id = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    indicator = relationship(
        "EvalSubIndicator",
        back_populates="checklists",
    )

    completion_records = relationship(
        "CompletionRecord",
        back_populates="checklist",
        cascade="all, delete-orphan",
        order_by="CompletionRecord.period_key",
    )

    occurrences = relationship(
        "ChecklistOccurrence",
        back_populates="checklist",
        cascade="all, delete-orphan",
        order_by="ChecklistOccurrence.period_key",
    )


class CompletionRecord(Base):
    __tablename__ = "completion_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    checklist_id = Column(
        String,
        ForeignKey("checklist_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_key = Column(String(20), nullable=False)
    completed_date = Column(String(20), nullable=False)
    memo = Column(Text, default="")
    attachment_name = Column(String(200), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    checklist = relationship(
        "ChecklistItem",
        back_populates="completion_records",
    )


class ChecklistOccurrence(Base):
    __tablename__ = "checklist_occurrences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    checklist_item_id = Column(
        String,
        ForeignKey("checklist_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_key = Column(String(20), nullable=False)
    frequency = Column(String(30), nullable=False)
    scheduled_date = Column(String(20), nullable=False)
    due_date = Column(String(20), nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    completed_date = Column(String(20), nullable=True)
    memo = Column(Text, default="")
    attachment_name = Column(String(200), default="")
    started_by = Column(String(100), nullable=True)      # 진행 중 착수자
    completed_by = Column(String(100), nullable=True)     # 완료 처리한 담당자
    started_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    checklist = relationship(
        "ChecklistItem",
        back_populates="occurrences",
    )


class LtcResident(Base):
    __tablename__ = "ltc_residents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, index=True)
    birth_date = Column(String(20), nullable=False)
    gender = Column(String(10), nullable=False)
    admission_date = Column(String(20), nullable=False)
    admission_time = Column(String(5), nullable=True)   # 입소 예정 시간 'HH:MM' — 미정이면 null
    discharge_date = Column(String(20), nullable=True)
    discharge_time = Column(String(5), nullable=True)   # HH:MM — 퇴소일 식수 계산 기준
    care_grade_start_date = Column(String(20), nullable=False)
    floor = Column(String(20), nullable=True, index=True)   # 어르신 생활 층
    room = Column(String(10), nullable=True, index=True)    # 호실 (예: 201) — 담당 명단의 뼈대
    religion = Column(String(20), nullable=True)            # 종교 (기독교·천주교·불교·무교 등)
    group_cognitive = Column(String(2), nullable=True)      # 인지 프로그램 그룹 A/B/C
    group_leisure = Column(String(2), nullable=True)        # 여가 프로그램 그룹 A/B/C
    group_physical = Column(String(2), nullable=True)       # 신체 프로그램 그룹 A/B/C
    tube_feeding = Column(Boolean, nullable=True, default=False)  # 경관식(비위관) — 식수 정산 제외
    status = Column(String(20), default="active", index=True)
    memo = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LtcStaffMember(Base):
    __tablename__ = "ltc_staff_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # 로그인 계정(users.id)과의 명시 연동 — 내 근무표·휴무 신청이 이걸 우선 사용한다.
    # (이름 매칭은 동명이인·개명에 취약해 fallback으로만 남긴다)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    birth_date = Column(String(20), nullable=False)
    gender = Column(String(10), nullable=False)
    hire_date = Column(String(20), nullable=False)
    position = Column(String(50), nullable=True)  # 직종
    resident_no = Column(String(20), nullable=True)      # 주민번호
    address = Column(Text, nullable=True)                # 주소(도로명/지번)
    address_detail = Column(Text, nullable=True)         # 상세주소
    phone = Column(String(30), nullable=True)            # 연락처
    license_date = Column(String(20), nullable=True)     # 자격증 발급일
    license_no = Column(String(50), nullable=True)       # 자격증 번호
    bank_account = Column(String(50), nullable=True)     # 통장번호
    leaves = Column(JSON, nullable=True)                 # 휴직 기간 [{start,end,reason}]
    resign_date = Column(String(20), nullable=True)
    status = Column(String(20), default="active", index=True)
    memo = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EvalSetting(Base):
    __tablename__ = "eval_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    facility_name = Column(String(100), default="행복한 요양원")
    eval_year = Column(Integer, default=2025)
    alert_days_before_due = Column(Integer, default=7)
    long_inactive_threshold_days = Column(Integer, default=14)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )