from fastapi import APIRouter
from app.api.v1.endpoints import auth, public, residents, staff, contacts, reviews, history, dashboard

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