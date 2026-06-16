"""
직원 계정 관리 API
POST   /api/v1/staff-accounts         — 직원 추가 (ADMIN)
GET    /api/v1/staff-accounts         — 직원 목록 (ADMIN/MANAGER)
PATCH  /api/v1/staff-accounts/:id     — 직원 수정 (ADMIN)
PATCH  /api/v1/staff-accounts/:id/deactivate
PATCH  /api/v1/staff-accounts/:id/activate
GET    /api/v1/staff-accounts/me
GET    /api/v1/staff-accounts/positions — 허용 직책 목록
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash
from app.models.user import User, UserRole, ALLOWED_POSITIONS
from app.schemas.response import ApiResponse

router = APIRouter()


# ── 스키마 ─────────────────────────────────────────────────────────────────────
class StaffCreate(BaseModel):
    name:       str
    email:      EmailStr
    password:   str
    role:       str = "STAFF"
    position:   Optional[str] = None
    department: Optional[str] = None
    phone:      Optional[str] = None

    @field_validator('position')
    @classmethod
    def validate_position(cls, v):
        if v is not None and v not in ALLOWED_POSITIONS:
            raise ValueError(f"허용되지 않는 직책입니다. 허용: {ALLOWED_POSITIONS}")
        return v

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        try:
            UserRole(v.upper())
        except ValueError:
            raise ValueError(f"유효하지 않은 권한: {v}")
        return v.upper()


class StaffUpdate(BaseModel):
    name:       Optional[str] = None
    role:       Optional[str] = None
    position:   Optional[str] = None
    department: Optional[str] = None
    phone:      Optional[str] = None
    password:   Optional[str] = None

    @field_validator('position')
    @classmethod
    def validate_position(cls, v):
        if v is not None and v not in ALLOWED_POSITIONS:
            raise ValueError(f"허용되지 않는 직책: {v}. 허용: {ALLOWED_POSITIONS}")
        return v


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────
def _to_dict(u: User) -> dict:
    return {
        "id":         u.id,
        "name":       u.name,
        "email":      u.email,
        "role":       u.role.value if hasattr(u.role, 'value') else u.role,
        "position":   u.position,
        "department": u.department,
        "phone":      u.phone,
        "is_active":  u.is_active if u.is_active is not None else True,
    }

def _require_admin(u: User):
    if u.role not in (UserRole.ADMIN, UserRole.MANAGER):  # MANAGER도 조회는 가능
        raise HTTPException(403, "권한이 없습니다")

def _require_admin_only(u: User):
    if u.role != UserRole.ADMIN:
        raise HTTPException(403, "관리자 권한이 필요합니다")


# ── 엔드포인트 ─────────────────────────────────────────────────────────────────
@router.get("/positions")
def get_positions():
    """허용 직책 목록 — 프론트 드롭다운용"""
    return ApiResponse(success=True, data=ALLOWED_POSITIONS)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return ApiResponse(success=True, data=_to_dict(current_user))


@router.get("")
def list_staff(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    users = db.query(User).order_by(User.name).all()
    return ApiResponse(success=True, data=[_to_dict(u) for u in users])


@router.post("")
def create_staff(
    body: StaffCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin_only(current_user)
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "이미 사용 중인 이메일입니다")

    u = User(
        id=str(uuid.uuid4()),
        name=body.name, email=body.email,
        hashed_password=get_password_hash(body.password),
        role=UserRole(body.role),
        position=body.position, department=body.department,
        phone=body.phone, is_active=True,
    )
    db.add(u); db.commit()
    return ApiResponse(success=True, data=_to_dict(u))


@router.patch("/{target_id}")
def update_staff(
    target_id: str,
    body: StaffUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin_only(current_user)
    u = db.query(User).filter(User.id == target_id).first()
    if not u: raise HTTPException(404, "직원을 찾을 수 없습니다")

    if body.name       is not None: u.name       = body.name
    if body.position   is not None: u.position   = body.position
    if body.department is not None: u.department = body.department
    if body.phone      is not None: u.phone      = body.phone
    if body.password:               u.hashed_password = get_password_hash(body.password)
    if body.role:
        u.role = UserRole(body.role.upper())

    db.commit()
    return ApiResponse(success=True, data=_to_dict(u))


@router.patch("/{target_id}/deactivate")
def deactivate(
    target_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin_only(current_user)
    u = db.query(User).filter(User.id == target_id).first()
    if not u: raise HTTPException(404)
    if u.id == current_user.id: raise HTTPException(400, "본인 계정은 비활성화할 수 없습니다")
    u.is_active = False; db.commit()
    return ApiResponse(success=True, data={"id": u.id, "is_active": False})


@router.patch("/{target_id}/activate")
def activate(
    target_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin_only(current_user)
    u = db.query(User).filter(User.id == target_id).first()
    if not u: raise HTTPException(404)
    u.is_active = True; db.commit()
    return ApiResponse(success=True, data={"id": u.id, "is_active": True})
