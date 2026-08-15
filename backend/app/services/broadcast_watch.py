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

# 알림을 보내기 전에 이만큼 연속으로 조용해야 한다. 순간적인 끊김에는 안 보낸다.
# (기기가 오프라인으로 '판정'되기까지 이미 BROADCAST_OFFLINE_SEC 이 걸린 뒤의 횟수다)
SUSTAIN_CHECKS = 3
# 회복 알림을 보내기 전에 이만큼 연속으로 정상이어야 한다 — 깜빡임에 반응하지 않게
RECOVER_CHECKS = 2
# 같은 기기를 다시 알리기까지의 최소 간격(분). 계속 꺼져 있으면 점점 뜸하게 알린다.
COOLDOWN_MIN = 180
COOLDOWN_MAX_MIN = 1440      # 하루에 한 번까지
# 마지막 알림(회복 알림 포함) 이후 최소한 이만큼은 지나야 다시 보낸다.
# 껐다 켜졌다를 반복하는 PC 가 시간당 여러 통을 만들지 않게 하는 바닥값.
REALERT_MIN_GAP_MIN = 60
# 이만큼 연속으로 정상이어야 '이제 안정됐다'고 보고 알림 횟수를 초기화한다.
# 그 전까지는 횟수가 유지돼 깜빡일수록 간격이 벌어진다.
STABLE_RESET_CHECKS = 60


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


def _backoff_min(alert_count: int) -> int:
    """알림을 거듭할수록 간격을 늘린다.

    며칠째 꺼져 있는 PC 를 3시간마다 알리는 것은 도움이 안 되고 메일함만 채운다.
    3시간 → 6시간 → 12시간 → 하루.
    """
    if alert_count <= 0:
        return 0
    return min(COOLDOWN_MIN * (2 ** (alert_count - 1)), COOLDOWN_MAX_MIN)


def evaluate(db: Session, state: Dict[str, Any], now_ts: float) -> List[Dict[str, Any]]:
    """알려야 할 기기 목록.

    메일이 쏟아지지 않게 세 가지를 지킨다.
      1) 연속 SUSTAIN_CHECKS 회 조용해야 첫 알림 — 잠깐 끊긴 것으로는 안 보낸다
      2) 회복돼도 쿨다운을 초기화하지 않는다 — 껐다 켜졌다 반복해도 계속 오지 않는다
      3) 계속 꺼져 있으면 간격을 늘린다(3h→6h→12h→하루)
    """
    if not settings.BROADCAST_ENABLED:
        return []
    st: Dict[str, Any] = state.setdefault("broadcast_offline", {})
    # 예전 형식(플랫 dict)은 버린다 — 남아 있어도 의미가 없다
    state.pop("broadcast_offline_sent", None)
    state.pop("broadcast_offline_firing", None)

    devices = db.query(BroadcastDevice).filter(BroadcastDevice.active == True).all()  # noqa: E712
    down_ids = {d.device_id for d in offline_devices(db)}
    alive_ids = {d.device_id for d in devices}
    alerts: List[Dict[str, Any]] = []

    for d in devices:
        e = st.setdefault(d.device_id, {"miss": 0, "ok": 0, "alerts": 0,
                                        "last_alert": None, "firing": False})
        if d.device_id in down_ids:
            e["miss"] = int(e.get("miss", 0)) + 1
            e["ok"] = 0
            if e["miss"] < SUSTAIN_CHECKS:
                continue                       # 아직은 지켜본다
            last = e.get("last_alert")
            # 회복 알림 직후에도 바닥값만큼은 쉰다 — 안 그러면 깜빡임이 그대로 메일이 된다
            gap = max(_backoff_min(int(e.get("alerts", 0))), REALERT_MIN_GAP_MIN) * 60
            if last is not None and (now_ts - last) < gap:
                continue                       # 쿨다운 중
            e["alerts"] = int(e.get("alerts", 0)) + 1
            e["last_alert"] = now_ts
            e["firing"] = True
            alerts.append({
                "device_id": d.device_id, "name": d.name,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
                "recovered": False,
                "repeat": e["alerts"],
                "next_after_min": _backoff_min(e["alerts"]),
            })
        else:
            e["ok"] = int(e.get("ok", 0)) + 1
            e["miss"] = 0
            if e.get("firing") and e["ok"] >= RECOVER_CHECKS:
                e["firing"] = False
                # 회복 시각도 last_alert 로 남긴다 — 바로 다시 꺼져도 곧장 또 보내지 않는다.
                # alerts 는 여기서 지우지 않는다. 깜빡이는 동안에는 횟수가 쌓여
                # 간격이 점점 벌어지고, 그래야 스스로 잦아든다.
                e["last_alert"] = now_ts
                alerts.append({"device_id": d.device_id, "name": d.name,
                               "last_seen": None, "recovered": True})
            elif e["ok"] >= STABLE_RESET_CHECKS and e.get("alerts"):
                # 충분히 오래 멀쩡했다 — 다음에 문제가 생기면 처음처럼 알린다
                e["alerts"] = 0

    # 삭제된 기기의 찌꺼기 정리
    for did in [k for k in st if k not in alive_ids]:
        st.pop(did, None)
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
