"""
채용 (MVP).
- 공개: 공고 목록 조회 / 지원 접수 (인증 불필요)
- 어드민: 공고 CRUD / 지원자 목록·상세·상태·메모 (ADMIN 또는 사회복지사)
- 이력서 파일은 보관하지 않고 지원자가 별도 이메일로 전송한다.
- 지원 접수 시 관리자 알림 메일(상담 메일 인프라 재사용).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.recruitment import RecruitmentPost, RecruitmentApplication, now_kst
from app.schemas.response import ApiResponse
from app.services.email_service import notify_admins_new_recruitment, recruitment_application_to_dict

logger = logging.getLogger("recruitment")

public_router = APIRouter()
admin_router = APIRouter()

POST_STATUS = ["모집중", "마감"]
APP_STATUS = ["접수", "검토중", "면접예정", "합격", "불합격"]


def _require_manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(status_code=403, detail="권한이 없습니다. (관리자 전용)")
    return current_user


def _post_view(p: RecruitmentPost) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "category": p.category,
        "employment_type": p.employment_type,
        "work_time": p.work_time,
        "salary": p.salary,
        "description": p.description,
        "status": p.status,
        "is_public": p.is_public,
        "sort_order": p.sort_order,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _app_view(a: RecruitmentApplication) -> dict:
    return {
        "id": a.id,
        "recruitment_post_id": a.recruitment_post_id,
        "category": a.category,
        "name": a.name,
        "birth": a.birth,
        "phone": a.phone,
        "email": a.email,
        "experience": a.experience,
        "introduction": a.introduction,
        "privacy_agreed": a.privacy_agreed,
        "status": a.status,
        "admin_memo": a.admin_memo,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# --------------------------------------------------------------------------- #
# 공개
# --------------------------------------------------------------------------- #
@public_router.get("/posts")
def public_posts(db: Session = Depends(get_db)):
    """공개된 공고 목록 (마감 포함 — UI에서 상태 표시)."""
    rows = (
        db.query(RecruitmentPost)
        .filter(RecruitmentPost.is_public.is_(True))
        .order_by(RecruitmentPost.sort_order.asc(), RecruitmentPost.created_at.desc())
        .all()
    )
    return ApiResponse(success=True, data=[_post_view(p) for p in rows])


class RecruitmentApplyBody(BaseModel):
    recruitment_post_id: Optional[str] = None
    category: Optional[str] = None
    name: str
    birth: Optional[str] = None
    phone: str
    email: Optional[str] = None
    experience: Optional[str] = None
    introduction: Optional[str] = None
    privacy_agreed: bool = False


@public_router.post("/apply")
def apply_recruitment(body: RecruitmentApplyBody, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not body.name.strip() or not body.phone.strip():
        raise HTTPException(status_code=400, detail="이름과 연락처를 입력해주세요.")
    if not body.privacy_agreed:
        raise HTTPException(status_code=400, detail="개인정보 수집에 동의해주세요.")

    category = (body.category or "").strip() or None
    # 공고 id가 있으면 카테고리 보정
    if body.recruitment_post_id:
        post = db.query(RecruitmentPost).filter(RecruitmentPost.id == body.recruitment_post_id).first()
        if post and not category:
            category = post.category or post.title

    a = RecruitmentApplication(
        recruitment_post_id=body.recruitment_post_id,
        category=category,
        name=body.name.strip(),
        birth=(body.birth or "").strip() or None,
        phone=body.phone.strip(),
        email=(body.email or "").strip() or None,
        experience=(body.experience or "").strip() or None,
        introduction=(body.introduction or "").strip() or None,
        privacy_agreed=True,
        status="접수",
    )
    db.add(a)
    db.commit()
    db.refresh(a)

    background_tasks.add_task(notify_admins_new_recruitment, recruitment_application_to_dict(a))

    return ApiResponse(success=True, message="지원해주셔서 감사합니다. 담당자가 검토 후 연락드리겠습니다.")


# --------------------------------------------------------------------------- #
# 어드민 — 공고
# --------------------------------------------------------------------------- #
class PostBody(BaseModel):
    title: str
    category: Optional[str] = None
    employment_type: Optional[str] = None
    work_time: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None
    sort_order: Optional[int] = None


@admin_router.get("/posts")
def admin_list_posts(db: Session = Depends(get_db), current_user: User = Depends(_require_manager)):
    rows = (
        db.query(RecruitmentPost)
        .order_by(RecruitmentPost.sort_order.asc(), RecruitmentPost.created_at.desc())
        .all()
    )
    return ApiResponse(success=True, data=[_post_view(p) for p in rows])


@admin_router.post("/posts")
def admin_create_post(body: PostBody, db: Session = Depends(get_db), current_user: User = Depends(_require_manager)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요.")
    p = RecruitmentPost(
        title=body.title.strip(),
        category=body.category,
        employment_type=body.employment_type,
        work_time=body.work_time,
        salary=body.salary,
        description=body.description,
        status=body.status if body.status in POST_STATUS else "모집중",
        is_public=bool(body.is_public) if body.is_public is not None else True,
        sort_order=body.sort_order or 0,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return ApiResponse(success=True, data=_post_view(p))


@admin_router.patch("/posts/{pid}")
def admin_update_post(pid: str, body: PostBody, db: Session = Depends(get_db), current_user: User = Depends(_require_manager)):
    p = db.query(RecruitmentPost).filter(RecruitmentPost.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
    if body.title is not None and body.title.strip():
        p.title = body.title.strip()
    if body.category is not None:
        p.category = body.category
    if body.employment_type is not None:
        p.employment_type = body.employment_type
    if body.work_time is not None:
        p.work_time = body.work_time
    if body.salary is not None:
        p.salary = body.salary
    if body.description is not None:
        p.description = body.description
    if body.status is not None:
        if body.status not in POST_STATUS:
            raise HTTPException(status_code=400, detail="잘못된 상태값입니다.")
        p.status = body.status
    if body.is_public is not None:
        p.is_public = bool(body.is_public)
    if body.sort_order is not None:
        p.sort_order = body.sort_order
    p.updated_at = now_kst()
    db.commit()
    db.refresh(p)
    return ApiResponse(success=True, data=_post_view(p))


@admin_router.delete("/posts/{pid}")
def admin_delete_post(pid: str, db: Session = Depends(get_db), current_user: User = Depends(_require_manager)):
    p = db.query(RecruitmentPost).filter(RecruitmentPost.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
    db.delete(p)
    db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


# --------------------------------------------------------------------------- #
# 어드민 — 지원자
# --------------------------------------------------------------------------- #
@admin_router.get("/applications")
def admin_list_applications(
    status: Optional[str] = Query(None),
    post_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_manager),
):
    q = db.query(RecruitmentApplication)
    if status and status in APP_STATUS:
        q = q.filter(RecruitmentApplication.status == status)
    if post_id:
        q = q.filter(RecruitmentApplication.recruitment_post_id == post_id)
    rows = q.order_by(RecruitmentApplication.created_at.desc()).all()
    counts = {s: db.query(RecruitmentApplication).filter(RecruitmentApplication.status == s).count() for s in APP_STATUS}
    return ApiResponse(success=True, data={"items": [_app_view(a) for a in rows], "counts": counts})


@admin_router.get("/applications/{aid}")
def admin_get_application(aid: str, db: Session = Depends(get_db), current_user: User = Depends(_require_manager)):
    a = db.query(RecruitmentApplication).filter(RecruitmentApplication.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="지원서를 찾을 수 없습니다.")
    return ApiResponse(success=True, data=_app_view(a))


class AppUpdateBody(BaseModel):
    status: Optional[str] = None
    admin_memo: Optional[str] = None


@admin_router.patch("/applications/{aid}")
def admin_update_application(aid: str, body: AppUpdateBody, db: Session = Depends(get_db), current_user: User = Depends(_require_manager)):
    a = db.query(RecruitmentApplication).filter(RecruitmentApplication.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="지원서를 찾을 수 없습니다.")
    if body.status is not None:
        if body.status not in APP_STATUS:
            raise HTTPException(status_code=400, detail="잘못된 상태값입니다.")
        a.status = body.status
    if body.admin_memo is not None:
        a.admin_memo = body.admin_memo
    a.updated_at = now_kst()
    db.commit()
    db.refresh(a)
    return ApiResponse(success=True, data=_app_view(a))
