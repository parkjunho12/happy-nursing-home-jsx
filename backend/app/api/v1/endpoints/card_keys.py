"""
출입 카드키 관리 (카드번호·소지자·보증금·반납 현황).
권한: ADMIN · 시설장 · 대표 · 이사
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staff_hr import CardKey, now_kst
from app.schemas.response import ApiResponse

router = APIRouter()


def _require(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    if role != "ADMIN" and pos not in ("시설장", "대표", "이사"):
        raise HTTPException(403, "카드키 관리 권한이 없습니다. (관리자·시설장·대표·이사)")
    return current_user


def _view(c: CardKey) -> dict:
    return {
        "id": c.id, "seq": c.seq,
        "card_number": c.card_number, "holder": c.holder, "staff_id": c.staff_id,
        "deposit_date": c.deposit_date, "deposit_method": c.deposit_method, "deposit_amount": c.deposit_amount,
        "returned": bool(c.returned), "return_date": c.return_date, "returner": c.returner,
        "refunded": bool(getattr(c, "refunded", False)), "refund_date": getattr(c, "refund_date", None),
        "memo": c.memo,
    }


class CardBody(BaseModel):
    card_number: Optional[str] = None
    holder: Optional[str] = None
    staff_id: Optional[str] = None
    deposit_date: Optional[str] = None
    deposit_method: Optional[str] = None
    deposit_amount: Optional[str] = None
    returned: Optional[bool] = None
    return_date: Optional[str] = None
    returner: Optional[str] = None
    refunded: Optional[bool] = None       # 보증금 이체 완료
    refund_date: Optional[str] = None
    memo: Optional[str] = None


def _clean(v):
    return (v or "").strip() or None if isinstance(v, str) else v


def _apply(c: CardKey, b: CardBody):
    # '안 보낸 필드'와 '명시적으로 null(지우기)'을 구분한다 —
    # 납부 취소·반납 취소가 날짜를 지워야 하는데 None 무시로는 안 지워진다
    sent = getattr(b, "model_fields_set", None) or getattr(b, "__fields_set__", set())
    for field in ("card_number", "holder", "staff_id", "deposit_date", "deposit_method",
                  "deposit_amount", "return_date", "returner", "refund_date", "memo"):
        val = getattr(b, field)
        if val is not None:
            setattr(c, field, _clean(val))
        elif field in sent:
            setattr(c, field, None)          # 명시적 null = 값 지우기
    if b.returned is not None:
        c.returned = bool(b.returned)
        if not b.returned:                 # 반납 취소 = 이체 상태도 원점
            c.refunded = False
            c.refund_date = None
    if b.refunded is not None:
        c.refunded = bool(b.refunded)


@router.get("/records")
def list_cards(db: Session = Depends(get_db), _: User = Depends(_require)):
    rows = db.query(CardKey).order_by(CardKey.seq.asc(), CardKey.created_at.asc()).all()
    return ApiResponse(success=True, data=[_view(r) for r in rows])


@router.post("/records")
def create_card(body: CardBody, db: Session = Depends(get_db), _: User = Depends(_require)):
    mx = db.query(CardKey).order_by(CardKey.seq.desc()).first()
    c = CardKey(seq=((mx.seq + 1) if (mx and mx.seq) else 1))
    _apply(c, body)
    db.add(c)
    db.commit()
    db.refresh(c)
    return ApiResponse(success=True, data=_view(c))


@router.patch("/records/{cid}")
def update_card(cid: str, body: CardBody, db: Session = Depends(get_db), _: User = Depends(_require)):
    c = db.query(CardKey).filter(CardKey.id == cid).first()
    if not c:
        raise HTTPException(404, "Not found")
    _apply(c, body)
    db.commit()
    db.refresh(c)
    return ApiResponse(success=True, data=_view(c))


@router.delete("/records/{cid}")
def delete_card(cid: str, db: Session = Depends(get_db), _: User = Depends(_require)):
    c = db.query(CardKey).filter(CardKey.id == cid).first()
    if not c:
        raise HTTPException(404, "Not found")
    db.delete(c)
    db.commit()
    return ApiResponse(success=True, message="Deleted")
