"""로그인 계정 → 직원(LtcStaffMember) 연결.

내 근무표·휴무 신청이 '지금 로그인한 사람이 명단의 누구인가'를 알아야 한다.
예전에는 이름으로만 찾아 동명이인이면 막혔는데, 이제 계정 관리에서
명시적으로 연동하면 그 연결을 최우선으로 쓴다. 이름 매칭은 미연동 계정을
위한 fallback으로만 남긴다.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.eval import LtcStaffMember
from app.models.user import User


def resolve_staff_for_user(db: Session, user: User) -> LtcStaffMember:
    uid = getattr(user, "id", None)
    if uid:
        linked = db.query(LtcStaffMember).filter(LtcStaffMember.user_id == uid).first()
        if linked:
            return linked

    name = (getattr(user, "name", None) or "").strip()
    if not name:
        raise HTTPException(404, "계정에 이름이 없어 직원을 찾을 수 없습니다.")
    rows = db.query(LtcStaffMember).filter(LtcStaffMember.name == name).all()
    active = [r for r in rows if (getattr(r, "status", "") or "active") == "active"]
    cand = active or rows
    if not cand:
        raise HTTPException(404, "직원 명단에서 이름을 찾지 못했습니다. 관리자에게 계정 연동을 요청하세요.")
    if len(cand) > 1:
        raise HTTPException(409, "같은 이름의 직원이 여러 명입니다. 관리자에게 계정 연동을 요청하세요.")
    return cand[0]
