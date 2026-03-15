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
