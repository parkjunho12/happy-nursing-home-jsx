from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.contact import Contact, ContactStatus
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.contact import (
    ContactResponse,
    ContactReplyRequest,
    ContactStatusUpdateRequest,
)

router = APIRouter()

def to_contact_dict(obj: Contact) -> dict:
    return ContactResponse.model_validate(obj).model_dump()


@router.get("", response_model=ApiResponse)
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contacts = db.query(Contact).order_by(Contact.created_at.desc()).all()
    data = [to_contact_dict(c) for c in contacts]
    return ApiResponse(success=True, data=data)


@router.get("/{contact_id}", response_model=ApiResponse)
def get_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ApiResponse(success=True, data=to_contact_dict(contact))


@router.put("/{contact_id}/reply", response_model=ApiResponse)
def reply_contact(
    contact_id: str,
    payload: ContactReplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.reply = payload.reply
    contact.status = ContactStatus.REPLIED           # ✅ Enum으로
    contact.replied_at = datetime.utcnow()           # timezone 통일하고 싶으면 func.now() 방식으로
    contact.replied_by = current_user.name or current_user.email

    db.commit()
    db.refresh(contact)
    return ApiResponse(success=True, data=to_contact_dict(contact))


@router.put("/{contact_id}/status", response_model=ApiResponse)
def update_contact_status(
    contact_id: str,
    payload: ContactStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # ✅ payload.status는 이미 "PENDING|REPLIED|CLOSED"로 검증됨
    contact.status = ContactStatus(payload.status)

    # 상태를 CLOSED로 바꾸는데 reply/replied_at이 없으면 자동으로 채우고 싶다면 여기서 처리 가능
    db.commit()
    db.refresh(contact)
    return ApiResponse(success=True, data=to_contact_dict(contact))


@router.delete("/{contact_id}", response_model=ApiResponse)
def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(contact)
    db.commit()
    return ApiResponse(success=True, message="Contact deleted")
