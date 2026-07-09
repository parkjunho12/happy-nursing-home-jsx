"""
FCM 푸시 발송 (Firebase Admin SDK)
- 서비스계정 JSON 경로: settings.FCM_CREDENTIALS_FILE
- 미설정/라이브러리 없음 → 발송 생략(no-op)하고 경고만 남김
"""
import logging
from typing import List, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)
_initialized = False
_app = None


def _ensure_app():
    global _initialized, _app
    if _initialized:
        return _app
    _initialized = True
    try:
        if not settings.FCM_CREDENTIALS_FILE:
            logger.info("FCM_CREDENTIALS_FILE 미설정 → 푸시 비활성")
            return None
        import firebase_admin
        from firebase_admin import credentials
        if firebase_admin._apps:
            _app = firebase_admin.get_app()
        else:
            cred = credentials.Certificate(settings.FCM_CREDENTIALS_FILE)
            _app = firebase_admin.initialize_app(cred)
        return _app
    except Exception as e:
        logger.warning(f"FCM 초기화 실패: {e}")
        _app = None
        return None


def is_available() -> bool:
    """FCM 초기화 가능 여부(서비스계정 설정+SDK 로드)."""
    return _ensure_app() is not None


def send_to_tokens(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    image: Optional[str] = None,
) -> Tuple[int, int, List[str]]:
    """
    여러 기기에 푸시 발송.
    반환: (성공 수, 실패 수, 무효 토큰 목록)
    """
    app = _ensure_app()
    tokens = [t for t in (tokens or []) if t]
    if not app or not tokens:
        return (0, 0, [])

    from firebase_admin import messaging

    success = failure = 0
    invalid: List[str] = []
    safe_data = {str(k): str(v) for k, v in (data or {}).items()}

    for i in range(0, len(tokens), 500):  # multicast 최대 500
        batch = tokens[i:i + 500]
        message = messaging.MulticastMessage(
            tokens=batch,
            notification=messaging.Notification(title=title, body=body, image=image),
            data=safe_data,
            android=messaging.AndroidConfig(priority="high"),
        )
        try:
            resp = messaging.send_each_for_multicast(message)
            success += resp.success_count
            failure += resp.failure_count
            for idx, r in enumerate(resp.responses):
                if not r.success:
                    err = str(getattr(r, "exception", "")).lower()
                    if "not-registered" in err or "invalid-argument" in err or "invalid" in err:
                        invalid.append(batch[idx])
        except Exception as e:
            logger.warning(f"FCM 발송 실패: {e}")
            failure += len(batch)

    return (success, failure, invalid)
