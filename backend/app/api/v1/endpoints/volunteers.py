"""
자원봉사 모집 (MVP).
- 공개: 신청 접수 (인증 불필요)
- 어드민: 목록/상세/상태·메모 수정 (ADMIN 또는 사회복지사)
"""
from __future__ import annotations

import logging
from typing import Optional, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.volunteer import VolunteerApplication, now_kst
from app.schemas.response import ApiResponse
from app.services.email_service import notify_admins_new_volunteer, volunteer_to_dict

logger = logging.getLogger("volunteer")

public_router = APIRouter()
admin_router = APIRouter()

VALID_STATUS = ["대기", "연락완료", "승인", "보류"]


def _require_volunteer_manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    position = current_user.position.value if hasattr(current_user.position, "value") else str(current_user.position or "")
    if role != "ADMIN" and position != "사회복지사":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    return current_user


def _view(v: VolunteerApplication) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "phone": v.phone,
        "birth_or_age": v.birth_or_age,
        "preferred_activity": v.preferred_activity,
        "preferred_day": v.preferred_day,
        "preferred_time": v.preferred_time,
        "experience": v.experience,
        "memo": v.memo,
        "privacy_agreed": v.privacy_agreed,
        "status": v.status,
        "admin_memo": v.admin_memo,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


# --------------------------------------------------------------------------- #
# 공개: 신청
# --------------------------------------------------------------------------- #
class VolunteerApplyBody(BaseModel):
    name: str
    phone: str
    birth_or_age: Optional[str] = None
    preferred_activity: Optional[str] = None
    preferred_day: Optional[str] = None
    preferred_time: Optional[str] = None
    experience: Optional[str] = None
    memo: Optional[str] = None
    privacy_agreed: bool = False


@public_router.post("/volunteer")
def apply_volunteer(body: VolunteerApplyBody, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not body.name.strip() or not body.phone.strip():
        raise HTTPException(status_code=400, detail="이름과 연락처를 입력해주세요.")
    if not body.privacy_agreed:
        raise HTTPException(status_code=400, detail="개인정보 수집에 동의해주세요.")

    v = VolunteerApplication(
        name=body.name.strip(),
        phone=body.phone.strip(),
        birth_or_age=(body.birth_or_age or "").strip() or None,
        preferred_activity=body.preferred_activity,
        preferred_day=body.preferred_day,
        preferred_time=body.preferred_time,
        experience=(body.experience or "").strip() or None,
        memo=(body.memo or "").strip() or None,
        privacy_agreed=True,
        status="대기",
    )
    db.add(v)
    db.commit()
    db.refresh(v)

    # 관리자 알림 메일 (상담 메일 인프라 재사용, 백그라운드)
    background_tasks.add_task(notify_admins_new_volunteer, volunteer_to_dict(v))

    return ApiResponse(success=True, message="신청이 완료되었습니다. 담당자가 확인 후 연락드리겠습니다.")


# --------------------------------------------------------------------------- #
# 어드민: 관리
# --------------------------------------------------------------------------- #
@admin_router.get("/volunteers")
def list_volunteers(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_volunteer_manager),
):
    q = db.query(VolunteerApplication)
    if status and status in VALID_STATUS:
        q = q.filter(VolunteerApplication.status == status)
    rows = q.order_by(VolunteerApplication.created_at.desc()).all()
    counts = {s: db.query(VolunteerApplication).filter(VolunteerApplication.status == s).count() for s in VALID_STATUS}
    return ApiResponse(success=True, data={"items": [_view(v) for v in rows], "counts": counts})


@admin_router.get("/volunteers/{vid}")
def get_volunteer(vid: str, db: Session = Depends(get_db),
                  current_user: User = Depends(_require_volunteer_manager)):
    v = db.query(VolunteerApplication).filter(VolunteerApplication.id == vid).first()
    if not v:
        raise HTTPException(status_code=404, detail="신청서를 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_view(v))


class VolunteerUpdateBody(BaseModel):
    status: Optional[str] = None
    admin_memo: Optional[str] = None


@admin_router.patch("/volunteers/{vid}")
def update_volunteer(vid: str, body: VolunteerUpdateBody, db: Session = Depends(get_db),
                     current_user: User = Depends(_require_volunteer_manager)):
    v = db.query(VolunteerApplication).filter(VolunteerApplication.id == vid).first()
    if not v:
        raise HTTPException(status_code=404, detail="신청서를 찾을 수 없습니다.")
    if body.status is not None:
        if body.status not in VALID_STATUS:
            raise HTTPException(status_code=400, detail="잘못된 상태값입니다.")
        v.status = body.status
    if body.admin_memo is not None:
        v.admin_memo = body.admin_memo
    v.updated_at = now_kst()
    db.commit()
    return ApiResponse(success=True, data=_view(v))
