from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.resident import Resident
from app.models.user import User
from app.schemas.resident import ResidentCreate, ResidentUpdate, ResidentResponse
from app.schemas.response import ApiResponse

router = APIRouter()

def to_resident_dict(obj: Resident) -> dict:
    return ResidentResponse.model_validate(obj).model_dump()


@router.get("", response_model=ApiResponse)
def list_residents(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    residents = db.query(Resident).order_by(Resident.created_at.desc()).all()
    data = [to_resident_dict(r) for r in residents]
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_resident(
    payload: ResidentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    resident = Resident(**payload.model_dump())
    db.add(resident)
    db.commit()
    db.refresh(resident)
    return ApiResponse(success=True, data=to_resident_dict(resident))


@router.get("/{resident_id}", response_model=ApiResponse)
def get_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    return ApiResponse(success=True, data=to_resident_dict(resident))


@router.put("/{resident_id}", response_model=ApiResponse)
def update_resident(
    resident_id: str,
    payload: ResidentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    patch = payload.model_dump(exclude_unset=True)
    for key, value in patch.items():
        setattr(resident, key, value)

    # DB onupdate가 있긴 하지만, 명시적으로 찍고 싶으면 유지
    resident.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(resident)
    return ApiResponse(success=True, data=to_resident_dict(resident))


@router.delete("/{resident_id}", response_model=ApiResponse)
def delete_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    db.delete(resident)
    db.commit()
    return ApiResponse(success=True, message="Resident deleted")
