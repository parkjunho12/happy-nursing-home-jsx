from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.eval import LtcResident, LtcStaffMember, ChecklistItem
from app.schemas.eval import (
    LtcResidentCreate, LtcResidentUpdate, LtcResidentOut, DischargeRequest,
    LtcStaffCreate, LtcStaffUpdate, LtcStaffOut, ResignRequest,
)
from app.schemas.response import ApiResponse
from typing import List

residents_router = APIRouter()
staff_router = APIRouter()


# ════════════════════════════════════════════════════════════════
# 평가용 수급자
# ════════════════════════════════════════════════════════════════

@residents_router.get("", response_model=ApiResponse)
def list_ltc_residents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(LtcResident).order_by(LtcResident.created_at.desc()).all()
    return ApiResponse(success=True, data=[LtcResidentOut.model_validate(r).model_dump() for r in rows])


@residents_router.post("", response_model=ApiResponse, status_code=201)
def create_ltc_resident(
    payload: LtcResidentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = LtcResident(**payload.model_dump(), status="active")
    db.add(r)
    db.commit()
    db.refresh(r)
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.get("/{rid}", response_model=ApiResponse)
def get_ltc_resident(rid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.patch("/{rid}", response_model=ApiResponse)
def update_ltc_resident(
    rid: str,
    payload: LtcResidentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.post("/{rid}/discharge", response_model=ApiResponse)
def discharge_ltc_resident(
    rid: str,
    payload: DischargeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    r.status = "discharged"
    r.discharge_date = payload.discharge_date
    # 미완료 입소 체크리스트 비활성화
    db.execute(
        update(ChecklistItem)
        .where(ChecklistItem.person_id == rid, ChecklistItem.completed == False)
        .values(active=False)
    )
    db.commit()
    db.refresh(r)
    return ApiResponse(success=True, data=LtcResidentOut.model_validate(r).model_dump())


@residents_router.delete("/{rid}", response_model=ApiResponse)
def delete_ltc_resident(rid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(LtcResident).filter(LtcResident.id == rid).first()
    if not r:
        raise HTTPException(404, "Not found")
    db.delete(r)
    db.commit()
    return ApiResponse(success=True, message="Deleted")


# ════════════════════════════════════════════════════════════════
# 평가용 직원
# ════════════════════════════════════════════════════════════════

@staff_router.get("", response_model=ApiResponse)
def list_ltc_staff(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(LtcStaffMember).order_by(LtcStaffMember.created_at.desc()).all()
    return ApiResponse(success=True, data=[LtcStaffOut.model_validate(s).model_dump() for s in rows])


@staff_router.post("", response_model=ApiResponse, status_code=201)
def create_ltc_staff(
    payload: LtcStaffCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = LtcStaffMember(**payload.model_dump(), status="active")
    db.add(s)
    db.commit()
    db.refresh(s)

    # 근로계약·서류(HR) 표에 자동 추가 (중복 방지)
    try:
        from app.models.staff_hr import StaffHrRecord
        exists = db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == s.id).first()
        if not exists:
            mx = db.query(StaffHrRecord).order_by(StaffHrRecord.seq.desc()).first()
            db.add(StaffHrRecord(
                staff_id=s.id, name=s.name,
                hire_date=getattr(s, "hire_date", None),
                seq=((mx.seq + 1) if (mx and mx.seq) else 1),
                contract_written=False,
            ))
            db.commit()
    except Exception:
        db.rollback()

    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.get("/{sid}", response_model=ApiResponse)
def get_ltc_staff(sid: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.patch("/{sid}", response_model=ApiResponse)
def update_ltc_staff(
    sid: str,
    payload: LtcStaffUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    fields = payload.model_dump(exclude_none=True)
    for k, v in fields.items():
        setattr(s, k, v)
    # 재직/퇴사 상태가 바뀌면 HR 표시 동기화
    if "status" in fields:
        try:
            from app.models.staff_hr import StaffHrRecord
            db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == sid).update(
                {"active": fields["status"] != "resigned"})
        except Exception:
            pass
    db.commit()
    db.refresh(s)
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())


@staff_router.post("/{sid}/resign", response_model=ApiResponse)
def resign_ltc_staff(
    sid: str,
    payload: ResignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = db.query(LtcStaffMember).filter(LtcStaffMember.id == sid).first()
    if not s:
        raise HTTPException(404, "Not found")
    s.status = "resigned"
    s.resign_date = payload.resign_date
    db.execute(
        update(ChecklistItem)
        .where(ChecklistItem.person_id == sid, ChecklistItem.completed == False)
        .values(active=False)
    )
    # 근로계약·서류 표에서 숨김
    try:
        from app.models.staff_hr import StaffHrRecord
        db.query(StaffHrRecord).filter(StaffHrRecord.staff_id == sid).update({"active": False})
    except Exception:
        pass
    db.commit()
    db.refresh(s)
    return ApiResponse(success=True, data=LtcStaffOut.model_validate(s).model_dump())
