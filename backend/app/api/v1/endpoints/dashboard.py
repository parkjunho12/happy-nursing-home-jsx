from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.contact import Contact, ContactStatus
from app.models.eval import LtcResident, LtcStaffMember
from app.schemas.response import ApiResponse

router = APIRouter()

KST = timezone(timedelta(hours=9))

def today_kst_str() -> str:
    return datetime.now(KST).strftime('%Y-%m-%d')

def this_month_kst_str() -> str:
    now = datetime.now(KST)
    return f"{now.year}-{now.month:02d}"

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    today = today_kst_str()
    this_month = this_month_kst_str()   # "2026-06"

    # 전체 수급자
    total_residents = db.query(func.count(LtcResident.id)).scalar() or 0

    # 활동 중인 수급자
    active_residents = db.query(func.count(LtcResident.id)).filter(
        LtcResident.status == 'active'
    ).scalar() or 0

    # 재직 중인 직원
    total_staff = db.query(func.count(LtcStaffMember.id)).filter(
        LtcStaffMember.status == 'active'
    ).scalar() or 0

    # 대기 중인 상담 (기존 테이블 유지)
    try:
        pending_contacts = db.query(func.count(Contact.id)).filter(
            Contact.status == ContactStatus.PENDING
        ).scalar() or 0
    except Exception:
        pending_contacts = 0

    # 오늘 입소 (admission_date = 오늘, KST 기준)
    today_admissions = db.query(func.count(LtcResident.id)).filter(
        LtcResident.admission_date == today
    ).scalar() or 0

    # 이번 달 입소 (admission_date가 이번 달, YYYY-MM으로 비교)
    monthly_admissions = db.query(func.count(LtcResident.id)).filter(
        func.substr(LtcResident.admission_date, 1, 7) == this_month
    ).scalar() or 0

    return ApiResponse(
        success=True,
        data={
            "totalResidents":    total_residents,
            "activeResidents":   active_residents,
            "totalStaff":        total_staff,
            "pendingContacts":   pending_contacts,
            "todayAdmissions":   today_admissions,
            "monthlyAdmissions": monthly_admissions,
        }
    )