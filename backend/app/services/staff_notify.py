"""직원앱 푸시 알림 발송."""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.staff_push import StaffPushToken
from app.services.fcm import send_to_tokens

logger = logging.getLogger(__name__)


def notify_user(db: Session, user_id: Optional[str], title: str, body: str, data: Optional[dict] = None) -> dict:
    """특정 직원에게 푸시. 무효 토큰 정리. 실패해도 예외 전파 안 함."""
    if not user_id:
        return {"tokens": 0, "sent": 0, "failed": 0}
    try:
        rows = db.query(StaffPushToken).filter(StaffPushToken.user_id == user_id).all()
        tokens = [t.token for t in rows]
        if not tokens:
            return {"tokens": 0, "sent": 0, "failed": 0}
        sent, failed, invalid = send_to_tokens(tokens, title, body, data=data or {})
        if invalid:
            db.query(StaffPushToken).filter(StaffPushToken.token.in_(invalid)).delete(synchronize_session=False)
            db.commit()
        return {"tokens": len(tokens), "sent": sent, "failed": failed}
    except Exception as e:
        logger.warning(f"직원 푸시 발송 생략: {e}")
        db.rollback()
        return {"tokens": 0, "sent": 0, "failed": 0, "error": str(e)}
