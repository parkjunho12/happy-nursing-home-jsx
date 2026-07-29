from fastapi import APIRouter
from app.api.v1.endpoints import auth, public, residents, staff, contacts, reviews, history, dashboard, tracking, eval_checklists, eval_indicators, eval_people
from app.api.v1.endpoints.eval_ai_review import router as eval_ai_router
from app.api.v1.endpoints.eval_occurrences import router as eval_occ_router
from app.api.v1.endpoints.eval_record_audit import router as eval_record_audit_router

from app.api.v1.endpoints.eval_carefor import router as eval_carefor_router
from app.api.v1.endpoints.blog_ai import router as blog_ai_router
from app.api.v1.endpoints.naver_ads import router as naver_ads_router
from app.api.v1.endpoints.volunteers import public_router as volunteer_public_router, admin_router as volunteer_admin_router
from app.api.v1.endpoints.marketing import public_router as marketing_public_router, admin_router as marketing_admin_router
from app.api.v1.endpoints.recruitment import public_router as recruitment_public_router, admin_router as recruitment_admin_router
from app.api.v1.endpoints.enteral import router as enteral_router
from app.api.v1.endpoints.schedule import router as schedule_router
from app.api.v1.endpoints.expense import router as expense_router
from app.api.v1.endpoints.albums import admin_router as album_admin_router, family_router as album_family_router
from app.api.v1.endpoints.facility_news import admin_router as news_admin_router, family_router as news_family_router
from app.api.v1.endpoints.visits import admin_router as visit_admin_router, family_router as visit_family_router
from app.api.v1.endpoints.incidents import router as incidents_router
from app.api.v1.endpoints.monthly_report import router as monthly_report_router
from app.api.v1.endpoints.payslips import router as payslips_router
from app.api.v1.endpoints.assignments import router as assignments_router
from app.api.v1.endpoints.rooms import router as rooms_router
from app.api.v1.endpoints.staff_push import router as staff_push_router
from app.api.v1.endpoints.staff_hr import router as staff_hr_router
from app.api.v1.endpoints.card_keys import router as card_keys_router
from app.api.v1.endpoints.staffing import router as staffing_router
from app.api.v1.endpoints.work_guide import router as work_guide_router
from app.api.v1.endpoints.notices import router as notices_router
from app.api.v1.endpoints.notice_templates import router as notice_templates_router
from app.api.v1.endpoints.work_schedule import router as work_schedule_router
from app.api.v1.endpoints.leave import router as leave_router
from app.api.v1.endpoints.handover import router as handover_router
from app.api.v1.endpoints.resident_docs import router as resident_docs_router
from app.api.v1.endpoints.staff_education import router as staff_education_router
api_router = APIRouter()

# Public endpoints (인증 불필요)
api_router.include_router(
    public.router,
    prefix="/public",
    tags=["public"]
)

# Auth endpoints
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"]
)

# Protected endpoints (관리자 전용)
api_router.include_router(
    residents.router,
    prefix="/residents",
    tags=["residents"]
)

api_router.include_router(
    staff.router,
    prefix="/staff",
    tags=["staff"]
)

# 직원 계정 관리 (User CRUD)
api_router.include_router(
    staff.router,
    prefix="/users",
    tags=["users"]
)


api_router.include_router(
    contacts.router,
    prefix="/contacts",
    tags=["contacts"]
)

api_router.include_router(
    reviews.router,
    prefix="/reviews",
    tags=["reviews"]
)

api_router.include_router(
    history.router,
    prefix="/history",
    tags=["history"]
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["dashboard"]
)

api_router.include_router(
    tracking.router,
    prefix="/track",
    tags=["tracking"]
)


api_router.include_router(eval_checklists.router,    prefix="/eval/checklists",   tags=["eval-checklists"])
api_router.include_router(eval_people.residents_router,   prefix="/eval/residents",    tags=["eval-residents"])
api_router.include_router(eval_people.staff_router, prefix="/eval/staff",        tags=["eval-staff"])
api_router.include_router(eval_indicators.eval_router,       prefix="/eval",              tags=["eval-indicators"])
api_router.include_router(eval_indicators.settings_router,   prefix="/eval/settings",     tags=["eval-settings"])
api_router.include_router(eval_indicators.eval_dash_router,  prefix="/eval/dashboard",    tags=["eval-dashboard"])
api_router.include_router(eval_ai_router,    prefix="/eval",              tags=["eval-ai-review"])
api_router.include_router(eval_occ_router,   prefix="/eval/occurrences",  tags=["eval-occurrences"])

# ── 앨범 (관리자 + 보호자) ─────────────────────────────────────────
api_router.include_router(album_admin_router,  prefix="/admin",  tags=["admin-albums"])
api_router.include_router(album_family_router, prefix="/family", tags=["family-albums"])

api_router.include_router(eval_record_audit_router, prefix="/eval/record-audit", tags=["eval-record-audit"])
api_router.include_router(eval_carefor_router, prefix="/eval/carefor", tags=["eval-carefor"])
api_router.include_router(blog_ai_router, prefix="/blog-ai", tags=["blog-ai"])
api_router.include_router(naver_ads_router, prefix="/admin/naver-ads", tags=["admin-naver-ads"])
api_router.include_router(volunteer_public_router, prefix="/public", tags=["volunteer-public"])
api_router.include_router(volunteer_admin_router, prefix="/admin", tags=["volunteer-admin"])
api_router.include_router(marketing_public_router, prefix="/public/marketing", tags=["marketing-public"])
api_router.include_router(marketing_admin_router, prefix="/admin/naver-ads", tags=["marketing-admin"])
api_router.include_router(recruitment_public_router, prefix="/public/recruitment", tags=["recruitment-public"])
api_router.include_router(recruitment_admin_router, prefix="/admin/recruitment", tags=["recruitment-admin"])
api_router.include_router(enteral_router, prefix="/admin/enteral", tags=["admin-enteral"])
api_router.include_router(schedule_router, prefix="/admin/schedule", tags=["admin-schedule"])
api_router.include_router(expense_router, prefix="/admin/expense", tags=["admin-expense"])
api_router.include_router(news_admin_router,  prefix="/admin",  tags=["admin-news"])
api_router.include_router(news_family_router, prefix="/family", tags=["family-news"])
api_router.include_router(visit_family_router, prefix="/family", tags=["family-visits"])
api_router.include_router(visit_admin_router, prefix="/admin", tags=["admin-visits"])
api_router.include_router(incidents_router, prefix="/admin/incidents", tags=["admin-incidents"])
api_router.include_router(monthly_report_router, prefix="/admin/reports", tags=["admin-reports"])
api_router.include_router(payslips_router, prefix="/admin/payslips", tags=["admin-payslips"])
api_router.include_router(assignments_router, prefix="/admin/assignments", tags=["admin-assignments"])
api_router.include_router(rooms_router, prefix="/admin/rooms", tags=["admin-rooms"])
api_router.include_router(staff_push_router, prefix="/staff/push", tags=["staff-push"])
api_router.include_router(staff_hr_router, prefix="/admin/staff-hr", tags=["admin-staff-hr"])
api_router.include_router(card_keys_router, prefix="/admin/card-keys", tags=["admin-card-keys"])
api_router.include_router(staffing_router, prefix="/admin/staffing", tags=["admin-staffing"])
api_router.include_router(work_guide_router, prefix="/admin/work-guide", tags=["admin-work-guide"])
api_router.include_router(notices_router, prefix="/admin/notices", tags=["admin-notices"])
api_router.include_router(notice_templates_router, prefix="/admin/notice-templates", tags=["admin-notice-templates"])
api_router.include_router(work_schedule_router, prefix="/admin/work-schedule", tags=["admin-work-schedule"])
api_router.include_router(leave_router, prefix="/admin/leave", tags=["admin-leave"])
api_router.include_router(handover_router, prefix="/admin/handover", tags=["admin-handover"])
api_router.include_router(resident_docs_router, prefix="/admin/resident-docs", tags=["admin-resident-docs"])
api_router.include_router(staff_education_router, prefix="/admin/educations", tags=["admin-educations"])
