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
from app.models.eval import LtcStaffMember
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
    allowed_menus: Optional[list] = None

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
    allowed_menus: Optional[list] = None

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
        "allowed_menus": u.allowed_menus or [],
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



def _role_str(u: User) -> str:
    return u.role.value if hasattr(u.role, "value") else str(u.role)

def _pos_str(u: User) -> str:
    p = getattr(u, "position", None)
    return p.value if hasattr(p, "value") else str(p or "")

def _is_admin_user(u: User) -> bool:
    return _role_str(u) == "ADMIN"

def _require_user_manager(current_user: User = Depends(get_current_user)) -> User:
    """직원 계정 관리: ADMIN 또는 시설장. (시설장은 ADMIN 계정 관리 불가 — 각 엔드포인트에서 강제)"""
    if _is_admin_user(current_user) or _pos_str(current_user) == "시설장":
        return current_user
    raise HTTPException(403, "직원 계정 관리 권한이 없습니다.")


# ── 전체 목록 (ADMIN·시설장) ────────────────────────────────────────────────────────
@router.get("")
def list_users(
    current_user: User = Depends(_require_user_manager),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.name).all()
    if not _is_admin_user(current_user):   # 시설장: ADMIN 계정 제외
        users = [u for u in users if _role_str(u) != "ADMIN"]
    # 연동된 직원을 한 번에 붙인다 — 계정 관리 화면의 '직원 연동' 열
    links = {r.user_id: r for r in
             db.query(LtcStaffMember).filter(LtcStaffMember.user_id.isnot(None)).all()}
    out = []
    for u in users:
        d = _to_dict(u)
        st = links.get(u.id)
        d["staff_link"] = ({"staff_id": st.id, "staff_name": st.name,
                            "position": st.position} if st else None)
        out.append(d)
    return {"success": True, "data": out}


# ── 직원 추가 (ADMIN만) ────────────────────────────────────────────────────────
@router.post("", status_code=201)
def create_user(
    body: UserCreate,
    current_user: User = Depends(_require_user_manager),
    db: Session = Depends(get_db),
):
    if not _is_admin_user(current_user) and body.role == "ADMIN":
        raise HTTPException(403, "관리자 계정 생성은 ADMIN만 가능합니다.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "이미 사용 중인 이메일입니다")

    u = User(
        id=str(uuid.uuid4()),
        name=body.name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=UserRole(body.role),
        position=body.position,
        allowed_menus=[str(x)[:60] for x in (body.allowed_menus or [])][:30] or None,
    )
    db.add(u)
    db.commit()
    return {"success": True, "data": _to_dict(u)}


# ── 직원 수정 (ADMIN만) ────────────────────────────────────────────────────────
@router.patch("/{target_id}")
def update_user(
    target_id: str,
    body: UserUpdate,
    current_user: User = Depends(_require_user_manager),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == target_id).first()
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    if not _is_admin_user(current_user):
        if _role_str(u) == "ADMIN":
            raise HTTPException(403, "관리자 계정은 수정할 수 없습니다.")
        if body.role == "ADMIN":
            raise HTTPException(403, "관리자 권한 부여는 ADMIN만 가능합니다.")

    if body.name     is not None: u.name     = body.name
    if body.position is not None: u.position = body.position
    if body.role     is not None: u.role     = UserRole(body.role)
    if body.allowed_menus is not None:
        u.allowed_menus = [str(x)[:60] for x in body.allowed_menus][:30] or None

    db.commit()
    return {"success": True, "data": _to_dict(u)}


# ── 비밀번호 변경 (ADMIN만) ────────────────────────────────────────────────────
@router.patch("/{target_id}/password")
def change_password(
    target_id: str,
    body: PasswordChange,
    current_user: User = Depends(_require_user_manager),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == target_id).first()
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    if not _is_admin_user(current_user) and _role_str(u) == "ADMIN":
        raise HTTPException(403, "관리자 계정은 관리할 수 없습니다.")
    u.hashed_password = get_password_hash(body.password)
    db.commit()
    return {"success": True, "data": {"id": u.id}}


# ── 삭제 (ADMIN만) ─────────────────────────────────────────────────────────────
@router.delete("/{target_id}")
def delete_user(
    target_id: str,
    current_user: User = Depends(_require_user_manager),
    db: Session = Depends(get_db),
):
    if target_id == current_user.id:
        raise HTTPException(400, "본인 계정은 삭제할 수 없습니다")
    u = db.query(User).filter(User.id == target_id).first()
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    if not _is_admin_user(current_user) and _role_str(u) == "ADMIN":
        raise HTTPException(403, "관리자 계정은 삭제할 수 없습니다.")
    db.delete(u)
    db.commit()
    return {"success": True, "data": None}


# ── 직원(명단) 연동 — ADMIN 전용 ────────────────────────────────────────────────
class StaffLinkBody(BaseModel):
    staff_id: Optional[str] = None    # null이면 해제


@router.put("/{user_id}/staff-link")
def set_staff_link(
    user_id: str,
    body: StaffLinkBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    """계정에 직원(명단)을 연결한다.

    이 연결이 있으면 내 근무표·휴무 신청이 이름 매칭 없이 정확히 그 직원으로 동작한다.
    규칙: 계정 하나 ↔ 직원 하나. 이미 다른 계정에 연결된 직원은 먼저 해제해야 한다."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "계정을 찾을 수 없습니다.")

    # 이 계정의 기존 연결 해제
    for prev in db.query(LtcStaffMember).filter(LtcStaffMember.user_id == user_id).all():
        prev.user_id = None

    if body.staff_id:
        st = db.query(LtcStaffMember).filter(LtcStaffMember.id == body.staff_id).first()
        if not st:
            raise HTTPException(404, "직원을 찾을 수 없습니다.")
        if st.user_id and st.user_id != user_id:
            other = db.query(User).filter(User.id == st.user_id).first()
            raise HTTPException(409,
                f"'{st.name}' 직원은 이미 다른 계정({getattr(other, 'email', st.user_id)})에 연동돼 있습니다. "
                f"그쪽 연동을 먼저 해제하세요.")
        st.user_id = user_id
        db.commit()
        return {"success": True,
                "data": {"staff_id": st.id, "staff_name": st.name, "position": st.position}}
    db.commit()
    return {"success": True, "data": None}
