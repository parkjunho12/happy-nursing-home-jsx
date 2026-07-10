"""직원앱 푸시 토큰 등록/해제."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.staff_push import StaffPushToken, now_kst
from app.schemas.response import ApiResponse

router = APIRouter()


class TokenBody(BaseModel):
    token: str
    platform: str = "android"


@router.post("/register")
def register_token(body: TokenBody, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    tok = (body.token or "").strip()
    if not tok:
        return ApiResponse(success=True, data={"ok": False})
    existing = db.query(StaffPushToken).filter(StaffPushToken.token == tok).first()
    if existing:
        existing.user_id = current_user.id
        existing.platform = body.platform or "android"
        existing.updated_at = now_kst()
    else:
        db.add(StaffPushToken(user_id=current_user.id, token=tok, platform=body.platform or "android"))
    db.commit()
    return ApiResponse(success=True, data={"ok": True})


@router.post("/unregister")
def unregister_token(body: TokenBody, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    db.query(StaffPushToken).filter(StaffPushToken.token == body.token).delete(synchronize_session=False)
    db.commit()
    return ApiResponse(success=True, data={"ok": True})
