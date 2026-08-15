"""서버 부하 현황 조회 · 알림 테스트 — ADMIN 전용.

실제로 부하가 걸릴 때까지 기다리지 않고도
'메일이 오긴 오는지'를 확인할 수 있어야 한다.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services import server_monitor

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    return current_user


@router.get("/status")
def status(_: User = Depends(_require_admin)):
    """지금 서버 상태 — 항목별 현재값·기준값·초과 여부."""
    snap = server_monitor.snapshot()
    if not snap.get("available"):
        raise HTTPException(503, "psutil 이 설치돼 있지 않아 서버 상태를 읽을 수 없습니다.")
    return ApiResponse(success=True, data={
        **snap,
        "alert_to": server_monitor._recipients(),
        "enabled": settings.SERVER_ALERT_ENABLED,
        "sustain_min": settings.SERVER_ALERT_SUSTAIN_MIN,
        "cooldown_min": settings.SERVER_ALERT_COOLDOWN_MIN,
    })


@router.post("/test-alert")
async def test_alert(_: User = Depends(_require_admin)):
    """지금 값 그대로 테스트 메일을 보낸다 — 수신 주소·발송 경로 점검용."""
    snap = server_monitor.snapshot()
    if not snap.get("available"):
        raise HTTPException(503, "psutil 이 설치돼 있지 않습니다.")
    to = server_monitor._recipients()
    if not to:
        raise HTTPException(400, "받는 사람이 설정돼 있지 않습니다. (SERVER_ALERT_TO)")

    ok = await server_monitor.send_alert("test", [], snap["checks"], snap["metrics"])
    if not ok:
        raise HTTPException(502, "메일 발송에 실패했습니다. 서버 로그를 확인해주세요.")
    return ApiResponse(success=True, message=f"{', '.join(to)} 로 테스트 메일을 보냈습니다.")
