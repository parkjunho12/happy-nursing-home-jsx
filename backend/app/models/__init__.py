# app/models/__init__.py

# -------------------------
# Admin / Internal Models
# -------------------------
from app.models.user import User, UserRole
from app.models.resident import Resident, Gender, ResidentStatus
from app.models.staff import Staff, StaffStatus
from app.models.contact import Contact, ContactStatus
from app.models.history import History, HistoryCategory
from app.models.review import Review

# -------------------------
# Public Website Models
# -------------------------
from app.models.public import (
    ContactTicket,
    PublicHistoryPost,
    PublicReview,
    PublicService,
    PublicDifferentiator,
    PublicInfo,
)

from app.models.click_event import ClickEvent

# -------------------------
# Evaluation Management Models
# -------------------------
from app.models.eval import (
    EvalDomain,
    EvalCategory,
    EvalSubIndicator,
    ChecklistItem,
    CompletionRecord,
    ChecklistOccurrence,
    LtcResident,
    LtcStaffMember,
    EvalSetting,
)
from app.models.eval_ai import EvalGuideline, EvalAIReview

__all__ = [
    # Internal
    "User",
    "UserRole",
    "Resident",
    "Gender",
    "ResidentStatus",
    "Staff",
    "StaffStatus",
    "Contact",
    "ContactStatus",
    "History",
    "HistoryCategory",
    "Review",
    "ClickEvent",

    # Public
    "ContactTicket",
    "PublicHistoryPost",
    "PublicReview",
    "PublicService",
    "PublicDifferentiator",
    "PublicInfo",
]

from app.models.carefor import CareforResident, CareforLeaveRecord, StaffWorkSchedule

from app.models.blog_ai import BlogAiLog

from app.models.push import FamilyPushToken

# Naver Ads
from app.models.naver_ads import NaverAdBidChangeLog, NaverAdsDaypartingConfig, NaverAdKeywordSchedule, NaverAdBidOverride

# Volunteer
from app.models.volunteer import VolunteerApplication

# Marketing CTA tracking
from app.models.marketing import MarketingCtaEvent

# Recruitment (채용)
from app.models.recruitment import RecruitmentPost, RecruitmentApplication, RecruitmentInterview

# 통합 일정
from app.models.schedule import ScheduleEvent
from app.models.expense import ExpenseRequest, ExpenseAttachment
from app.models.album_view import FamilyAlbumView
from app.models.facility_news import FacilityNews
from app.models.staff_push import StaffPushToken
from app.models.staff_hr import StaffHrRecord
from app.models.resident_docs import ResidentDocStatus, ResidentDocChange
from app.models.staff_education import StaffEducation

# 경관식 재고
from app.models.enteral import EnteralProduct, EnteralTransaction
from app.models.record_audit import RecordAudit  # noqa: F401
from app.models.work_schedule import WorkSchedule, WorkScheduleVersion, WorkScheduleConfig  # noqa: F401
from app.models.handover import HandoverReport  # noqa: F401
from app.models.leave import LeaveRequest, SwapRequest  # noqa: F401
from app.models.meal import MealWeek, MealTimeSetting  # noqa: F401
from app.models.pension import PensionEntry, PensionRefund  # noqa: F401
from app.models.audit_check import AuditRound, AuditItem  # noqa: F401
from app.models.operations import OperationContract, OperationPayItem, OperationPayment  # noqa: F401
from app.models.admin_routine import AdminRoutine, AdminRoutineDone  # noqa: F401
from app.models.broadcast import (  # noqa: F401
    BroadcastDevice, BroadcastMedia, BroadcastSchedule,
    BroadcastRun, BroadcastLog, BroadcastCommand,
)
from app.models import ai_editor  # noqa: F401
from app.models import therapy  # noqa: F401,E402  치료 프로그램 조 편성

# 직원 평가(인사고과) — 반기마다 한 번, 관리자만 본다
from app.models.staff_eval import (
    StaffEvaluation, StaffEvalConfig, EVAL_ITEMS, MAX_SCORE, FULL_MARKS,
)

# 응급벨 명단 — 벨 번호마다 어느 어르신인지
from app.models.emergency_bell import EmergencyBell

# 담당 어르신 명단에 함께 붙는 메모
from app.models.assign_note import AssignNote
