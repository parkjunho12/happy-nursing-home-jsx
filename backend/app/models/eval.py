from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class FrequencyEnum(str, enum.Enum):
    daily        = "daily"
    weekly       = "weekly"
    monthly      = "monthly"
    quarterly    = "quarterly"
    half_yearly  = "half-yearly"
    yearly       = "yearly"
    on_admission = "on_admission"
    on_discharge = "on_discharge"
    on_hire      = "on_hire"


class RiskEnum(str, enum.Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class PersonTypeEnum(str, enum.Enum):
    resident = "resident"
    staff    = "staff"
    facility = "facility"


class GenderEnum(str, enum.Enum):
    male   = "male"
    female = "female"


class EvalDomain(Base):
    __tablename__ = "eval_domains"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String(100), nullable=False)
    color      = Column(String(30), default="blue")
    sort_order = Column(Integer, default=0)
    active     = Column(Boolean, default=True)

    categories = relationship(
        "EvalCategory",
        back_populates="domain",
        cascade="all, delete-orphan",
        order_by="EvalCategory.sort_order",
    )


class EvalCategory(Base):
    __tablename__ = "eval_categories"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    domain_id      = Column(
        String,
        ForeignKey("eval_domains.id", ondelete="CASCADE"),
        nullable=False,
    )
    name           = Column(String(100), nullable=False)
    question_count = Column(Integer, default=0)
    total_score    = Column(Integer, default=0)
    sort_order     = Column(Integer, default=0)
    active         = Column(Boolean, default=True)

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

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id   = Column(
        String,
        ForeignKey("eval_categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    name          = Column(String(100), nullable=False)
    score         = Column(Integer, default=0)
    criteria      = Column(Text, default="")
    evidence_list = Column(Text, default="[]")
    sort_order    = Column(Integer, default=0)
    active        = Column(Boolean, default=True)

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

    id                   = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title                = Column(String(200), nullable=False)
    description          = Column(Text, default="")
    frequency            = Column(SQLEnum(FrequencyEnum), nullable=False)

    related_indicator_id = Column(
        String,
        ForeignKey("eval_sub_indicators.id", ondelete="SET NULL"),
        nullable=True,
    )
    related_category_id  = Column(
        String,
        ForeignKey("eval_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    related_domain_id    = Column(
        String,
        ForeignKey("eval_domains.id", ondelete="SET NULL"),
        nullable=True,
    )

    assignee             = Column(String(100), default="")
    evidence_required    = Column(Text, default="")
    storage_location     = Column(String(200), default="")
    how_to               = Column(Text, default="")
    eval_note            = Column(Text, default="")
    risk_level           = Column(SQLEnum(RiskEnum), default=RiskEnum.medium)
    active               = Column(Boolean, default=True)
    memo                 = Column(Text, default="")
    attachment_name      = Column(String(200), default="")
    completed            = Column(Boolean, default=False)
    completed_date       = Column(String(20), nullable=True)
    last_checked_date    = Column(String(20), nullable=True)
    person_id            = Column(String, nullable=True, index=True)
    person_name          = Column(String(100), nullable=True)
    person_type          = Column(SQLEnum(PersonTypeEnum), nullable=True)
    template_id          = Column(String(50), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

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


class CompletionRecord(Base):
    __tablename__ = "completion_records"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    checklist_id    = Column(
        String,
        ForeignKey("checklist_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_key      = Column(String(20), nullable=False)
    completed_date  = Column(String(20), nullable=False)
    memo            = Column(Text, default="")
    attachment_name = Column(String(200), default="")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    checklist = relationship(
        "ChecklistItem",
        back_populates="completion_records",
    )


class LtcResident(Base):
    __tablename__ = "ltc_residents"

    id                    = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name                  = Column(String(100), nullable=False, index=True)
    birth_date            = Column(String(20), nullable=False)
    gender                = Column(SQLEnum(GenderEnum), nullable=False)
    admission_date        = Column(String(20), nullable=False)
    discharge_date        = Column(String(20), nullable=True)
    care_grade_start_date = Column(String(20), nullable=False)
    status                = Column(String(20), default="active", index=True)
    memo                  = Column(Text, default="")
    created_at            = Column(DateTime(timezone=True), server_default=func.now())


class LtcStaffMember(Base):
    __tablename__ = "ltc_staff_members"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name        = Column(String(100), nullable=False, index=True)
    birth_date  = Column(String(20), nullable=False)
    gender      = Column(SQLEnum(GenderEnum), nullable=False)
    hire_date   = Column(String(20), nullable=False)
    resign_date = Column(String(20), nullable=True)
    status      = Column(String(20), default="active", index=True)
    memo        = Column(Text, default="")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class EvalSetting(Base):
    __tablename__ = "eval_settings"

    id                           = Column(Integer, primary_key=True, autoincrement=True)
    facility_name                = Column(String(100), default="행복한 요양원")
    eval_year                    = Column(Integer, default=2025)
    alert_days_before_due        = Column(Integer, default=7)
    long_inactive_threshold_days = Column(Integer, default=14)
    updated_at                   = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )