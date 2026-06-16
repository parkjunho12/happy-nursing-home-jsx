"""
평가 관리 모델
"""

from datetime import datetime, timezone, timedelta
import uuid
import enum

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


class FrequencyEnum(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    half_yearly = "half-yearly"
    yearly = "yearly"
    on_admission = "on_admission"
    on_discharge = "on_discharge"
    on_hire = "on_hire"


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

    assignee = Column(String(100), default="")
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

    assigned_user_id = Column(String, nullable=True, index=True)
    assigned_by = Column(String, nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)

    person_id = Column(String, nullable=True, index=True)
    person_name = Column(String(100), nullable=True)
    person_type = Column(String(20), nullable=True)
    template_id = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)

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
    created_at = Column(DateTime(timezone=True), default=now_kst)

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

    assigned_user_id = Column(String, nullable=True, index=True)
    completed_by_user_id = Column(String, nullable=True, index=True)

    rejected_by_user_id = Column(String, nullable=True, index=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    attachment_url = Column(String(500), nullable=True)
    extended_status = Column(String(30), nullable=True)

    memo = Column(Text, default="")
    attachment_name = Column(String(200), default="")

    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)

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
    discharge_date = Column(String(20), nullable=True)
    care_grade_start_date = Column(String(20), nullable=False)
    status = Column(String(20), default="active", index=True)
    memo = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=now_kst)


class LtcStaffMember(Base):
    __tablename__ = "ltc_staff_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, index=True)
    birth_date = Column(String(20), nullable=False)
    gender = Column(String(10), nullable=False)
    hire_date = Column(String(20), nullable=False)
    resign_date = Column(String(20), nullable=True)
    status = Column(String(20), default="active", index=True)
    memo = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=now_kst)


class EvalSetting(Base):
    __tablename__ = "eval_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    facility_name = Column(String(100), default="행복한 요양원")
    eval_year = Column(Integer, default=2025)
    alert_days_before_due = Column(Integer, default=7)
    long_inactive_threshold_days = Column(Integer, default=14)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)


class ChecklistActivityLog(Base):
    __tablename__ = "checklist_activity_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    checklist_item_id = Column(
        String,
        ForeignKey("checklist_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    occurrence_id = Column(
        String,
        ForeignKey("checklist_occurrences.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    actor_user_id = Column(String, nullable=False, index=True)

    action = Column(String(50), nullable=False)

    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=True)

    from_assignee = Column(String, nullable=True)
    to_assignee = Column(String, nullable=True)

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_kst)
    
# ── 체크리스트 다중 담당자 연결 테이블 ──────────────────────────────────────────
class ChecklistItemAssignee(Base):
    """체크리스트 항목 ↔ 직원(User) 다대다 연결"""
    __tablename__ = "checklist_item_assignees"

    id                = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    checklist_item_id = Column(String, nullable=False, index=True)
    user_id           = Column(String, nullable=False, index=True)
    assigned_by       = Column(String, nullable=True)
    assigned_at       = Column(DateTime(timezone=True), default=now_kst)