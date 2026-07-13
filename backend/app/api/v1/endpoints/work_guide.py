"""
직종별 업무 가이드 — 열람 권한 판정 (백엔드 강제).

가이드 '콘텐츠'는 프론트 라우트/메뉴 메타데이터와 1:1로 연결되므로 프론트 설정에 둔다.
서버는 '어느 직종 가이드를 볼 수 있는가'를 판정해 다른 직종 URL 직접 접근을 차단한다.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.response import ApiResponse

router = APIRouter()

# 직종(position) → 가이드 role 코드
POSITION_TO_ROLE = {
    "시설장": "facility_head",
    "사회복지사": "social_worker",
    "간호사": "nurse",
    "간호조무사": "nurse_assistant",
    "요양보호사": "caregiver",
}
ALL_ROLES = ["facility_head", "social_worker", "nurse", "nurse_assistant", "caregiver"]
# 전체 직종 가이드 열람 가능 — ADMIN · 대표 · 이사 · 시설장
VIEW_ALL_POSITIONS = ("시설장", "대표", "이사")


def _role_pos(current_user: User):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else (pos or "")
    return role, str(pos or "")


@router.get("/roles")
def my_roles(current_user: User = Depends(get_current_user)):
    """로그인 사용자가 열람 가능한 직종 가이드 목록."""
    role, pos = _role_pos(current_user)
    can_view_all = (role == "ADMIN") or (pos in VIEW_ALL_POSITIONS)
    my_role = POSITION_TO_ROLE.get(pos)
    allowed = ALL_ROLES if can_view_all else ([my_role] if my_role else [])
    return ApiResponse(success=True, data={
        "position": pos or None,
        "my_role": my_role,
        "allowed_roles": allowed,
        "can_view_all": can_view_all,
        "has_position": bool(pos),
    })


@router.get("/check")
def check_role(role: str = Query(...), current_user: User = Depends(get_current_user)):
    """특정 직종 가이드 열람 가능 여부 — 불가 시 403 (URL 직접 접근 차단)."""
    if role not in ALL_ROLES:
        raise HTTPException(404, "존재하지 않는 직종 가이드입니다.")
    urole, pos = _role_pos(current_user)
    can_view_all = (urole == "ADMIN") or (pos in VIEW_ALL_POSITIONS)
    my_role = POSITION_TO_ROLE.get(pos)
    if not can_view_all and role != my_role:
        raise HTTPException(403, "본인 직종의 업무 가이드만 볼 수 있습니다.")
    return ApiResponse(success=True, data={"role": role, "allowed": True})
