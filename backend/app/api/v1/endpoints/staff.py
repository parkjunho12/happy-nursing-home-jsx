"""
직원(User) 계정 관리 API  — /api/v1/staff
ADMIN만 호출 가능 (get_current_admin_user)
"""
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin_user, get_password_hash
from app.models.user import User, UserRole, ALLOWED_POSITIONS

router = APIRouter()


# ── 스키마 ─────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id:         str
    email:      str
    name:       str
    role:       str
    position:   Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email:    EmailStr
    name:     str
    password: str
    role:     str = "STAFF"
    position: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = v.upper()
        if v not in ("ADMIN", "STAFF"):
            raise ValueError("role은 ADMIN 또는 STAFF만 허용됩니다")
        return v

    @field_validator("position")
    @classmethod
    def validate_position(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_POSITIONS:
            raise ValueError(f"허용되지 않는 직종입니다. 허용값: {ALLOWED_POSITIONS}")
        return v


class UserUpdate(BaseModel):
    name:     Optional[str] = None
    role:     Optional[str] = None
    position: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.upper() not in ("ADMIN", "STAFF"):
            raise ValueError("role은 ADMIN 또는 STAFF만 허용됩니다")
        return v.upper() if v else v

    @field_validator("position")
    @classmethod
    def validate_position(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_POSITIONS:
            raise ValueError(f"허용되지 않는 직종: {v}")
        return v


class PasswordChange(BaseModel):
    password: str


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────
def _to_dict(u: User) -> dict:
    return {
        "id":         u.id,
        "email":      u.email,
        "name":       u.name,
        "role":       u.role.value if hasattr(u.role, "value") else str(u.role),
        "position":   u.position,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ── 내 정보 ────────────────────────────────────────────────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"success": True, "data": _to_dict(current_user)}


# ── 담당자 선택용 목록 (STAFF도 조회 가능 — 체크리스트 담당자 UI용) ───────────
@router.get("/assignee-options")
def assignee_options(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.name).all()
    return {"success": True, "data": [_to_dict(u) for u in users]}


# ── 전체 목록 (ADMIN만) ────────────────────────────────────────────────────────
@router.get("")
def list_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.name).all()
    return {"success": True, "data": [_to_dict(u) for u in users]}


# ── 직원 추가 (ADMIN만) ────────────────────────────────────────────────────────
@router.post("", status_code=201)
def create_user(
    body: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "이미 사용 중인 이메일입니다")

    u = User(
        id=str(uuid.uuid4()),
        name=body.name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=UserRole(body.role),
        position=body.position,
    )
    db.add(u)
    db.commit()
    return {"success": True, "data": _to_dict(u)}


# ── 직원 수정 (ADMIN만) ────────────────────────────────────────────────────────
@router.patch("/{target_id}")
def update_user(
    target_id: str,
    body: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == target_id).first()
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    if body.name     is not None: u.name     = body.name
    if body.position is not None: u.position = body.position
    if body.role     is not None: u.role     = UserRole(body.role)

    db.commit()
    return {"success": True, "data": _to_dict(u)}


# ── 비밀번호 변경 (ADMIN만) ────────────────────────────────────────────────────
@router.patch("/{target_id}/password")
def change_password(
    target_id: str,
    body: PasswordChange,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == target_id).first()
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    u.hashed_password = get_password_hash(body.password)
    db.commit()
    return {"success": True, "data": {"id": u.id}}


# ── 삭제 (ADMIN만) ─────────────────────────────────────────────────────────────
@router.delete("/{target_id}")
def delete_user(
    target_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    if target_id == current_user.id:
        raise HTTPException(400, "본인 계정은 삭제할 수 없습니다")
    u = db.query(User).filter(User.id == target_id).first()
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    db.delete(u)
    db.commit()
    return {"success": True, "data": None}
