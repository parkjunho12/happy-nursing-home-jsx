"""응급벨 명단 — 벨 번호마다 어느 어르신인지.

■ 권한

  보는 것은 직원이면 누구나. 벨이 울렸을 때 달려가는 사람이 요양보호사이고,
  그분들이 못 보면 이 명단은 있으나 마나다.

  고치는 것은 어르신 배치를 아는 직군만. 아무나 이름을 바꾸면 응급 상황에
  엉뚱한 방으로 달려간다.

■ 배치는 안 고친다

  벨 번호·호실·구분은 설비라서 여기서 바꾸지 않는다(마이그레이션으로만).
  화면에서 고칠 수 있게 두면 누가 잘못 만졌을 때 실제 설비와 어긋난다.
  바꾸는 것은 이름과 상태뿐이다.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.emergency_bell import EmergencyBell, STATUSES, WC_KINDS
from app.schemas.response import ApiResponse

router = APIRouter()

# 이름을 고칠 수 있는 직군 — 어르신이 어느 방에 계신지 아는 사람들
EDIT_POSITIONS = ("시설장", "대표", "이사", "간호팀장", "간호사", "간호조무사",
                  "사회복지사", "요양팀장")
NAME_MAX = 20


def _role(u: User) -> str:
    return u.role.value if hasattr(u.role, "value") else str(u.role)


def can_edit(role: str, position) -> bool:
    """이름을 고칠 권한이 있는가.

    요양보호사는 보기만 한다 — 벨을 받고 달려가는 분들이라 명단은 꼭 봐야
    하지만, 어느 방에 누가 계신지 정하는 것은 그분들 일이 아니다.
    """
    if role == "ADMIN":
        return True
    return (position or "") in EDIT_POSITIONS


def _editor(current_user: User = Depends(get_current_user)) -> User:
    if not can_edit(_role(current_user), getattr(current_user, "position", None)):
        raise HTTPException(403, "응급벨 명단 수정은 관리자·시설장·간호·사회복지 직군만 가능합니다.")
    return current_user


def _view(b: EmergencyBell) -> dict:
    return {
        "id": b.id, "floor": b.floor, "no": b.no, "room": b.room,
        "kind": b.kind, "note": b.note,
        "resident_name": b.resident_name, "status": b.status,
        "is_wc": b.kind in WC_KINDS,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
        "updated_by": b.updated_by,
    }


@router.get("")
def list_bells(floor: Optional[str] = Query(None), db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    """그 층의 벨 명단. floor 를 비우면 전 층."""
    q = db.query(EmergencyBell)
    if floor:
        q = q.filter(EmergencyBell.floor == floor)
    rows = q.order_by(EmergencyBell.floor, EmergencyBell.no).all()
    floors = [f[0] for f in db.query(EmergencyBell.floor).distinct()
              .order_by(EmergencyBell.floor).all()]
    return ApiResponse(success=True, data={
        "floors": floors,
        "rows": [_view(b) for b in rows],
        # 화면이 이걸 보고 수정 칸을 열지 말지 정한다(서버에서도 다시 막는다)
        "can_edit": can_edit(_role(current_user), getattr(current_user, "position", None)),
    })


class BellBody(BaseModel):
    resident_name: Optional[str] = None
    status: Optional[str] = None


@router.put("/{bell_id}")
def update_bell(bell_id: str, body: BellBody, db: Session = Depends(get_db),
                current_user: User = Depends(_editor)):
    b = db.query(EmergencyBell).filter(EmergencyBell.id == bell_id).first()
    if not b:
        raise HTTPException(404, "그 벨을 찾을 수 없습니다.")
    if b.kind in WC_KINDS:
        # 화장실 칸에 사람 이름이 들어가면 배치도가 거짓말이 된다
        raise HTTPException(400, "화장실 벨에는 이름을 넣지 않습니다.")

    name = (body.resident_name or "").strip()[:NAME_MAX]
    st = (body.status or "").strip()
    if st and st not in STATUSES:
        raise HTTPException(400, f"상태는 {' 또는 '.join(STATUSES)} 만 쓸 수 있습니다.")
    # 이름이 없는데 '재실' 은 말이 안 된다 — 배치도에 빈칸이 재실로 찍힌다
    if st == STATUSES[0] and not name:
        raise HTTPException(400, "이름 없이 '재실'로 둘 수 없습니다.")

    b.resident_name = name or None
    b.status = st or None
    b.updated_by = current_user.name
    db.commit(); db.refresh(b)
    return ApiResponse(success=True, data=_view(b))


class BulkBody(BaseModel):
    items: list = []


@router.put("")
def update_many(body: BulkBody, db: Session = Depends(get_db),
                current_user: User = Depends(_editor)):
    """여러 칸을 한 번에 저장 — 배치가 한꺼번에 바뀌는 일이 흔하다.

    한 칸이 잘못돼도 나머지는 저장한다. 스무 칸을 고쳤는데 하나 때문에
    전부 되돌아가면 그 스무 번을 다시 해야 한다. 대신 무엇이 안 됐는지 돌려준다.
    """
    ok, failed = 0, []
    for it in (body.items or []):
        if not isinstance(it, dict):
            continue
        b = db.query(EmergencyBell).filter(EmergencyBell.id == str(it.get("id"))).first()
        if not b or b.kind in WC_KINDS:
            failed.append({"id": it.get("id"), "reason": "없거나 화장실 칸"})
            continue
        name = str(it.get("resident_name") or "").strip()[:NAME_MAX]
        st = str(it.get("status") or "").strip()
        if st and st not in STATUSES:
            failed.append({"id": it.get("id"), "reason": "상태 값이 이상함"}); continue
        if st == STATUSES[0] and not name:
            failed.append({"id": it.get("id"), "reason": "이름 없이 재실"}); continue
        b.resident_name = name or None
        b.status = st or None
        b.updated_by = current_user.name
        ok += 1
    db.commit()
    return ApiResponse(success=True, data={"saved": ok, "failed": failed})
