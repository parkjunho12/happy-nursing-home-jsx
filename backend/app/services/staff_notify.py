"""직원앱 푸시 알림 발송."""
import logging
from typing import Optional, List
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


def notify_all_staff(
    db: Session,
    title: str,
    body: str,
    data: Optional[dict] = None,
    exclude_user_id: Optional[str] = None,
) -> dict:
    """전 직원(등록된 모든 기기)에게 푸시 브로드캐스트.

    - exclude_user_id: 보통 작성자 본인 — 자기 글 알림을 받지 않도록 제외
    - 같은 토큰이 중복 저장돼 있어도 1회만 발송(set 으로 중복 제거)
    - 무효 토큰은 정리, 실패해도 예외를 전파하지 않음(공지 등록 자체는 성공해야 함)
    """
    try:
        q = db.query(StaffPushToken)
        if exclude_user_id:
            q = q.filter(StaffPushToken.user_id != exclude_user_id)
        rows = q.all()

        tokens: List[str] = sorted({t.token for t in rows if t.token})
        recipients = len({t.user_id for t in rows if t.token})
        if not tokens:
            return {"tokens": 0, "recipients": 0, "sent": 0, "failed": 0}

        sent, failed, invalid = send_to_tokens(tokens, title, body, data=data or {})
        if invalid:
            db.query(StaffPushToken).filter(StaffPushToken.token.in_(invalid)).delete(synchronize_session=False)
            db.commit()
        return {"tokens": len(tokens), "recipients": recipients, "sent": sent, "failed": failed}
    except Exception as e:
        logger.warning(f"전 직원 푸시 발송 생략: {e}")
        db.rollback()
        return {"tokens": 0, "recipients": 0, "sent": 0, "failed": 0, "error": str(e)}
