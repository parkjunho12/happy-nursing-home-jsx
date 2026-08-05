"""지도점검 종합 체크리스트 API.

열람·체크·담당자 지정 = 전 직원 / 회차 생성·삭제 = ADMIN·시설장.
체크하면 누가 했는지(checked_by)가 자동 기록된다.
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.audit_check import AuditRound, AuditItem, now_kst
from app.schemas.response import ApiResponse

router = APIRouter()


def _viewer(current_user: User = Depends(get_current_user)) -> User:
    """열람·체크 — 요양보호사·앨범담당 제외 전 직원"""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos in ("요양보호사", "앨범담당"):
        raise HTTPException(403, "지도점검 체크리스트 접근 권한이 없습니다.")
    return current_user


def _manager(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None) or ""
    if role != "ADMIN" and pos != "시설장":
        raise HTTPException(403, "점검 회차 관리 권한이 없습니다. (관리자·시설장)")
    return current_user


@router.get("/rounds")
def list_rounds(db: Session = Depends(get_db), _: User = Depends(_viewer)):
    rounds = db.query(AuditRound).order_by(AuditRound.date.desc()).all()
    # 진행률 함께
    out = []
    for r in rounds:
        total = db.query(AuditItem).filter(AuditItem.round_id == r.id).count()
        done = db.query(AuditItem).filter(AuditItem.round_id == r.id, AuditItem.checked == True).count()  # noqa: E712
        out.append({"id": r.id, "date": r.date, "title": r.title,
                    "created_by": r.created_by, "total": total, "done": done})
    return ApiResponse(success=True, data=out)


class RoundBody(BaseModel):
    date: str
    title: Optional[str] = None


@router.post("/rounds")
def create_round(body: RoundBody, db: Session = Depends(get_db),
                 current_user: User = Depends(_manager)):
    """점검일을 정하면 회차가 생기고 152개 항목이 시드된다."""
    from app.services.audit_template import AUDIT_TEMPLATE
    r = AuditRound(date=body.date, title=(body.title or "").strip() or None,
                   created_by=getattr(current_user, "name", None))
    db.add(r)
    db.flush()
    for t in AUDIT_TEMPLATE:
        db.add(AuditItem(round_id=r.id, section=t["section"], sub=t.get("sub"),
                         title=t["title"], order=t["order"]))
    db.commit()
    return ApiResponse(success=True, data={"id": r.id, "date": r.date, "count": len(AUDIT_TEMPLATE)})


@router.delete("/rounds/{rid}")
def delete_round(rid: str, db: Session = Depends(get_db), _: User = Depends(_manager)):
    db.query(AuditItem).filter(AuditItem.round_id == rid).delete(synchronize_session=False)
    db.query(AuditRound).filter(AuditRound.id == rid).delete(synchronize_session=False)
    db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


@router.get("/rounds/{rid}/items")
def list_items(rid: str, db: Session = Depends(get_db), _: User = Depends(_viewer)):
    rows = (db.query(AuditItem).filter(AuditItem.round_id == rid)
            .order_by(AuditItem.order).all())
    return ApiResponse(success=True, data=[{
        "id": i.id, "section": i.section, "sub": i.sub, "title": i.title,
        "assignee_name": i.assignee_name, "checked": bool(i.checked),
        "checked_by": i.checked_by,
        "checked_at": i.checked_at.isoformat() if i.checked_at else None,
        "note": i.note,
    } for i in rows])


@router.delete("/items/{iid}")
def delete_item(iid: str, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """항목 삭제 — ADMIN 전용 (이번 회차에서만 빠진다. 다음 회차엔 다시 생성됨)."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "항목 삭제는 ADMIN만 가능합니다.")
    i = db.query(AuditItem).filter(AuditItem.id == iid).first()
    if not i:
        raise HTTPException(404, "항목을 찾을 수 없습니다.")
    db.delete(i)
    db.commit()
    return ApiResponse(success=True, message="삭제되었습니다.")


class ItemBody(BaseModel):
    checked: Optional[bool] = None
    assignee_name: Optional[str] = None   # '' = 해제
    note: Optional[str] = None


@router.patch("/items/{iid}")
def patch_item(iid: str, body: ItemBody, db: Session = Depends(get_db),
               current_user: User = Depends(_viewer)):
    i = db.query(AuditItem).filter(AuditItem.id == iid).first()
    if not i:
        raise HTTPException(404, "항목을 찾을 수 없습니다.")
    if body.checked is not None:
        i.checked = body.checked
        if body.checked:
            i.checked_by = getattr(current_user, "name", None)
            i.checked_at = now_kst()
        else:
            i.checked_by = None
            i.checked_at = None
    if body.assignee_name is not None:
        i.assignee_name = body.assignee_name.strip() or None
    if body.note is not None:
        i.note = body.note.strip() or None
    db.commit()
    return ApiResponse(success=True, data={
        "id": i.id, "checked": bool(i.checked), "checked_by": i.checked_by,
        "checked_at": i.checked_at.isoformat() if i.checked_at else None,
        "assignee_name": i.assignee_name, "note": i.note,
    })
