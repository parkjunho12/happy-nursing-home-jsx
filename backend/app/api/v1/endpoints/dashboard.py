from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.resident import Resident, ResidentStatus
from app.models.staff import Staff, StaffStatus
from app.models.contact import Contact, ContactStatus
from app.schemas.response import ApiResponse

router = APIRouter()

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    # 전체 입소자
    total_residents = db.query(func.count(Resident.id)).scalar() or 0
    
    # 활동 중인 입소자
    active_residents = db.query(func.count(Resident.id)).filter(
        Resident.status == ResidentStatus.ACTIVE
    ).scalar() or 0
    
    # 재직 중인 직원
    total_staff = db.query(func.count(Staff.id)).filter(
        Staff.status == StaffStatus.ACTIVE
    ).scalar() or 0
    
    # 대기 중인 상담
    pending_contacts = db.query(func.count(Contact.id)).filter(
        Contact.status == ContactStatus.PENDING
    ).scalar() or 0
    
    # 오늘 입소한 입소자 (admission_date가 오늘인 경우)
    today = datetime.utcnow().date()
    today_admissions = db.query(func.count(Resident.id)).filter(
        func.date(Resident.admission_date) == today
    ).scalar() or 0
    
    # 이번 달 입소한 입소자
    first_day_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_admissions = db.query(func.count(Resident.id)).filter(
        Resident.admission_date >= first_day_of_month
    ).scalar() or 0
    
    return ApiResponse(
        success=True,
        data={
            "totalResidents": total_residents,
            "activeResidents": active_residents,
            "totalStaff": total_staff,
            "pendingContacts": pending_contacts,
            "todayAdmissions": today_admissions,
            "monthlyAdmissions": monthly_admissions
        }
    )