from fastapi import APIRouter
from app.api.v1.endpoints import auth, public, residents, staff, contacts, reviews, history, dashboard, tracking, eval_checklists, eval_indicators, eval_people
from app.api.v1.endpoints.eval_ai_review import router as eval_ai_router
from app.api.v1.endpoints.eval_occurrences import router as eval_occ_router
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