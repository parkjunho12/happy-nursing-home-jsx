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
from app.models.eval import LtcResident
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


def room_key(v) -> str:
    """호실 표기를 맞춘다.

    수급자 관리는 '301', 응급벨은 '301호' 로 적는다. 둘을 그냥 비교하면
    어느 방 어르신인지 영영 못 찾아서, 골라 넣는 기능이 통째로 안 먹는다.
    """
    return str(v or "").strip().replace("호", "").strip()


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
    # 이름을 직접 치지 않고 고르게 한다 — 오타가 나면 응급 상황에 헛사람을 찾는다.
    # 입소 중인 분만 준다(퇴소한 분이 목록에 있으면 실수로 고르게 된다).
    residents = [
        {"name": r.name, "floor": r.floor or "", "room": room_key(r.room)}
        for r in db.query(LtcResident)
        .filter(LtcResident.status.in_(["active", "pending"]))
        .order_by(LtcResident.floor, LtcResident.room, LtcResident.name).all()
    ]
    return ApiResponse(success=True, data={
        "floors": floors,
        "rows": [_view(b) for b in rows],
        "residents": residents,
        # 화면이 이걸 보고 수정 칸을 열지 말지 정한다(서버에서도 다시 막는다)
        "can_edit": can_edit(_role(current_user), getattr(current_user, "position", None)),
        "can_edit_layout": can_edit_layout(_role(current_user), getattr(current_user, "position", None)),
    })


class BellBody(BaseModel):
    resident_name: Optional[str] = None
    status: Optional[str] = None


# ── 라우트 순서 주의 ─────────────────────────────────────────────
# /layout 은 반드시 /{bell_id} 보다 위에 있어야 한다. 아래에 두면 FastAPI 가
# /layout 을 bell_id="layout" 으로 읽어 '그 벨을 찾을 수 없습니다' 를 돌려준다.
# 실제로 그렇게 배포됐다가 벨 번호 수정이 통째로 안 먹었다.

# 벨 번호를 바꿀 수 있는 사람 — 설비가 바뀌었을 때만 손대는 일이라 좁게 둔다
LAYOUT_POSITIONS = ("시설장",)


def can_edit_layout(role: str, position) -> bool:
    if role == "ADMIN":
        return True
    return (position or "") in LAYOUT_POSITIONS


def _layout_editor(current_user: User = Depends(get_current_user)) -> User:
    if not can_edit_layout(_role(current_user), getattr(current_user, "position", None)):
        raise HTTPException(403, "벨 번호 수정은 관리자·시설장만 가능합니다.")
    return current_user


class LayoutBody(BaseModel):
    items: list = []


@router.put("/layout")
def update_layout(body: LayoutBody, db: Session = Depends(get_db),
                  current_user: User = Depends(_layout_editor)):
    """벨 번호 바꾸기 — 설비가 바뀌었을 때.

    한 층을 통째로 받아 한꺼번에 검사하고 한꺼번에 쓴다. 한 칸씩 고치면
    9번과 10번을 맞바꾸는 순간 잠깐 번호가 겹치는데, 그때 저장이 막혀서
    맞바꾸기를 아예 못 하게 된다.

    번호가 겹치면 전부 되돌린다. 이건 벨이 울렸을 때 갈 방을 찾는 번호라,
    절반만 바뀐 상태로 남으면 그 층 배치도 전체를 믿을 수 없게 된다.
    """
    items = [i for i in (body.items or []) if isinstance(i, dict)]
    if not items:
        raise HTTPException(400, "바꿀 내용이 없습니다.")

    rows = {b.id: b for b in db.query(EmergencyBell)
            .filter(EmergencyBell.id.in_([str(i.get("id")) for i in items])).all()}
    if len(rows) != len(items):
        raise HTTPException(400, "없는 벨이 섞여 있습니다.")

    floors = {b.floor for b in rows.values()}
    if len(floors) != 1:
        raise HTTPException(400, "한 번에 한 층만 바꿀 수 있습니다.")
    floor = floors.pop()

    # 그 층 전체를 놓고 겹치는지 본다 — 손대지 않은 벨과도 겹치면 안 된다
    final = {b.id: b.no for b in db.query(EmergencyBell)
             .filter(EmergencyBell.floor == floor).all()}
    for i in items:
        try:
            n = int(i.get("no"))
        except (TypeError, ValueError):
            raise HTTPException(400, "벨 번호는 숫자여야 합니다.")
        if not (1 <= n <= 99):
            raise HTTPException(400, "벨 번호는 1~99 사이여야 합니다.")
        final[str(i.get("id"))] = n

    seen: dict = {}
    for bid, n in final.items():
        if n in seen:
            raise HTTPException(400, f"{floor}에 {n}번이 두 개입니다. 번호는 겹칠 수 없습니다.")
        seen[n] = bid

    # 두 번에 나눠 쓴다.
    #
    # 유니크 제약은 트랜잭션이 끝날 때가 아니라 UPDATE 한 줄마다 검사된다.
    # 그래서 1번↔2번을 맞바꾸면, 1번을 2로 바꾸는 순간 아직 2번인 줄과
    # 겹쳐서 거절당한다. 한 트랜잭션에 묶어도 마찬가지다(실제로 그렇게
    # 만들었다가 맞바꾸기가 통째로 안 됐다).
    #
    # 그래서 먼저 음수로 옮겨 두고(그 층에 음수는 없다), 그다음 제 번호를
    # 준다. 중간 상태는 트랜잭션 밖에서 보이지 않는다.
    try:
        for k, i in enumerate(items, start=1):
            rows[str(i.get("id"))].no = -k
        db.flush()
        for i in items:
            b = rows[str(i.get("id"))]
            b.no = int(i.get("no"))
            b.updated_by = current_user.name
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(400, "벨 번호를 바꾸지 못했습니다. 번호가 겹치지 않는지 확인해주세요.")
    return ApiResponse(success=True, data={"changed": len(items), "floor": floor})


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
