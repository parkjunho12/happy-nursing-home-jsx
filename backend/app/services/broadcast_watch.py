"""방송 PC 감시 — 꺼져 있으면 알린다.

방송 시스템의 가장 흔한 사고는 '예약은 멀쩡한데 PC가 꺼져 있어 아무 소리도 안 난 것'이다.
그날 저녁에야 알게 되면 이미 늦다. 그래서 조용해지면 메일로 알린다.

스케줄링은 server_monitor 의 감시 루프에 얹는다 — 리더 선출·주기 관리를
두 번 만들지 않기 위해서다. 판단 로직만 여기에 둔다.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.broadcast import BroadcastDevice, now_kst

logger = logging.getLogger(__name__)

# 같은 기기를 계속 알리지 않는다
COOLDOWN_MIN = 120


def offline_devices(db: Session) -> List[BroadcastDevice]:
    """등록돼 있는데 조용한 방송 PC들."""
    now = now_kst()
    limit = timedelta(seconds=settings.BROADCAST_OFFLINE_SEC)
    out = []
    for d in db.query(BroadcastDevice).filter(BroadcastDevice.active == True).all():  # noqa: E712
        seen = d.last_seen
        if seen is not None and seen.tzinfo is None:
            seen = seen.replace(tzinfo=now.tzinfo)
        if seen is None or (now - seen) > limit:
            out.append(d)
    return out


def evaluate(db: Session, state: Dict[str, Any], now_ts: float) -> List[Dict[str, Any]]:
    """알려야 할 기기 목록. state 에 마지막 발송 시각을 기록해 반복 발송을 막는다."""
    if not settings.BROADCAST_ENABLED:
        return []
    sent: Dict[str, float] = state.setdefault("broadcast_offline_sent", {})
    firing: List[str] = state.setdefault("broadcast_offline_firing", [])

    down = offline_devices(db)
    down_ids = {d.device_id for d in down}
    alerts = []
    for d in down:
        last = sent.get(d.device_id)
        if last is None or (now_ts - last) >= COOLDOWN_MIN * 60:
            sent[d.device_id] = now_ts
            alerts.append({
                "device_id": d.device_id, "name": d.name,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
                "recovered": False,
            })
            if d.device_id not in firing:
                firing.append(d.device_id)

    # 돌아온 기기 — 한 번 알리고 끝낸다
    for did in list(firing):
        if did not in down_ids:
            firing.remove(did)
            sent.pop(did, None)
            alerts.append({"device_id": did, "name": did, "last_seen": None, "recovered": True})
    return alerts


def render(alerts: List[Dict[str, Any]]) -> Dict[str, str]:
    down = [a for a in alerts if not a["recovered"]]
    back = [a for a in alerts if a["recovered"]]
    if down:
        subject = f"[방송 경고] 방송 PC {len(down)}대 응답 없음"
        head, color = "방송 PC가 꺼져 있습니다", "#dc2626"
        lead = ("이 상태에서는 예약된 안내방송이 나가지 않습니다. "
                "PC 전원과 네트워크를 확인해주세요.")
    else:
        subject = f"[방송 회복] 방송 PC {len(back)}대 정상"
        head, color = "방송 PC가 정상으로 돌아왔습니다", "#059669"
        lead = "예약된 안내방송이 다시 정상적으로 나갑니다."

    rows = "".join(
        f'<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700">{a["name"]}</td>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888">{a["device_id"]}</td>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;color:'
        f'{"#059669" if a["recovered"] else "#dc2626"}">'
        f'{"정상" if a["recovered"] else "응답 없음"}</td>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888;font-size:12px">'
        f'{a["last_seen"] or "-"}</td></tr>'
        for a in alerts)

    html = f"""
    <div style="font-family:-apple-system,'Malgun Gothic',sans-serif;max-width:640px;margin:0 auto">
      <div style="border-left:5px solid {color};padding:12px 16px;background:#fafafa;border-radius:8px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">{head}</h2>
        <p style="margin:0;color:#666;font-size:13px">{lead}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:14px">
        <thead><tr style="background:#f4f4f5">
          <th style="text-align:left;padding:8px 10px">이름</th>
          <th style="text-align:left;padding:8px 10px">기기</th>
          <th style="text-align:left;padding:8px 10px">상태</th>
          <th style="text-align:left;padding:8px 10px">마지막 응답</th>
        </tr></thead><tbody>{rows}</tbody>
      </table>
      <p style="color:#aaa;font-size:11px;margin-top:16px">
        행복한요양원 안내방송 감시 · 소방·비상방송 설비와는 무관합니다.
      </p>
    </div>"""
    text = f"{head}\n{lead}\n\n" + "\n".join(
        f"- {a['name']}({a['device_id']}): {'정상' if a['recovered'] else '응답 없음'}" for a in alerts)
    return {"subject": subject, "html": html, "text": text}


async def notify(alerts: List[Dict[str, Any]]) -> bool:
    if not alerts:
        return False
    from app.services.server_monitor import _recipients
    to = _recipients()
    if not to:
        return False
    from app.services.email_service import send_email
    body = render(alerts)
    try:
        await send_email(to=to, subject=body["subject"], html=body["html"], text=body["text"])
        logger.info("방송 PC 알림 발송 → %s", ", ".join(to))
        return True
    except Exception as e:                       # 메일 실패가 감시를 멈추면 안 된다
        logger.error("방송 PC 알림 실패 %s: %s", type(e).__name__, e)
        return False
