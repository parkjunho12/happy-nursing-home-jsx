"""서버 부하 감시 — 임계치를 넘으면 메일로 알린다.

기준 사양: 2 vCPU / 4GB RAM / SSD 50GB / 일 20GB 트래픽.

설계 원칙 세 가지:
1) 순간 튐으로는 안 보낸다 — SUSTAIN_MIN 분 동안 '계속' 넘어야 발송.
   (사진 업로드 한 번에 CPU가 잠깐 100% 치는 건 정상이다)
2) 같은 항목은 COOLDOWN_MIN 분에 한 통 — 밤새 수십 통이 쌓이지 않게.
3) 정상으로 돌아오면 회복 메일을 한 통 — '그래서 지금은 괜찮은가'를 메일함에서 바로 알 수 있게.

uvicorn --workers 2 로 뜨므로 워커마다 루프가 돈다.
같은 컨테이너 안이라 파일 락으로 한 워커만 감시역을 맡는다(리더).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))
GB = 1024 ** 3

# 리더 락 — 이 시간(초) 동안 갱신이 없으면 다른 워커가 감시역을 넘겨받는다
_LEADER_TTL_SEC = 180


def _now() -> datetime:
    return datetime.now(KST)


def _recipients() -> List[str]:
    return [e.strip() for e in (settings.SERVER_ALERT_TO or "").split(",") if e.strip()]


# ──────────────────────────────────────────────────────────────
# 측정
# ──────────────────────────────────────────────────────────────
def collect_metrics(cpu_interval: float = 1.0) -> Dict[str, Any]:
    """지금 이 순간의 서버 상태. psutil이 없으면 빈 값을 돌려주고 감시는 조용히 쉰다."""
    try:
        import psutil
    except ImportError:      # 의존성이 빠진 배포에서도 서버는 정상 기동해야 한다
        return {"available": False}

    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()

    try:
        load1, load5, load15 = psutil.getloadavg()
    except (OSError, AttributeError):
        load1 = load5 = load15 = 0.0

    cores = psutil.cpu_count() or 1
    return {
        "available": True,
        "at": _now().isoformat(),
        "cpu_pct": psutil.cpu_percent(interval=cpu_interval),
        "cores": cores,
        # load average는 '코어당' 으로 환산해야 사양이 달라도 같은 의미가 된다 (1.0 = 딱 포화)
        "load1_per_core": round(load1 / cores, 2),
        "load5_per_core": round(load5 / cores, 2),
        "load15_per_core": round(load15 / cores, 2),
        "mem_pct": mem.percent,
        "mem_used_gb": round(mem.used / GB, 2),
        "mem_total_gb": round(mem.total / GB, 2),
        "swap_pct": swap.percent,
        "disk_pct": disk.percent,
        "disk_used_gb": round(disk.used / GB, 1),
        "disk_total_gb": round(disk.total / GB, 1),
        "net_sent": net.bytes_sent,
        "net_recv": net.bytes_recv,
    }


def accumulate_traffic(state: Dict[str, Any], metrics: Dict[str, Any]) -> float:
    """오늘(KST) 누적 트래픽 GB — 카운터 증가분을 더해 나간다.

    호스트가 아니라 앱 컨테이너 기준 추정치다. 재기동으로 카운터가 0부터 다시 세면
    증가분이 음수가 되는데, 그때는 그 구간을 버린다(빼지 않는다)."""
    today = _now().strftime("%Y-%m-%d")
    if state.get("traffic_date") != today:
        state["traffic_date"] = today
        state["traffic_bytes"] = 0
        state["net_last"] = None

    total = (metrics.get("net_sent") or 0) + (metrics.get("net_recv") or 0)
    last = state.get("net_last")
    if last is not None and total >= last:
        state["traffic_bytes"] = state.get("traffic_bytes", 0) + (total - last)
    state["net_last"] = total
    return round(state.get("traffic_bytes", 0) / GB, 2)


# ──────────────────────────────────────────────────────────────
# 판정
# ──────────────────────────────────────────────────────────────
def build_checks(metrics: Dict[str, Any], traffic_gb: float) -> List[Dict[str, Any]]:
    """항목별 현재값·임계치·초과 여부(over). 메일 본문도 이 목록으로 그린다.

    over 를 여기서 정해 두는 이유: 스왑처럼 '값만 보면 안 되는' 항목이 있어서다.
    스왑은 예전에 밀어둔 페이지가 그대로 남아 수치가 높게 유지되는 게 정상이라,
    메모리까지 같이 높을 때만 진짜 메모리 부족이다.
    """
    swap_gated = metrics["mem_pct"] >= settings.SERVER_ALERT_SWAP_MEM_GATE_PCT
    checks = [
        {"key": "cpu", "label": "CPU 사용률",
         "value": metrics["cpu_pct"], "limit": settings.SERVER_ALERT_CPU_PCT, "unit": "%",
         "over": metrics["cpu_pct"] >= settings.SERVER_ALERT_CPU_PCT,
         "detail": f"{metrics['cores']}코어 · 최근 5분 부하 {metrics['load5_per_core']}/코어"},
        {"key": "mem", "label": "메모리 사용률",
         "value": metrics["mem_pct"], "limit": settings.SERVER_ALERT_MEM_PCT, "unit": "%",
         "over": metrics["mem_pct"] >= settings.SERVER_ALERT_MEM_PCT,
         "detail": f"{metrics['mem_used_gb']}GB / {metrics['mem_total_gb']}GB"},
        {"key": "swap", "label": "스왑 사용률",
         "value": metrics["swap_pct"], "limit": settings.SERVER_ALERT_SWAP_PCT, "unit": "%",
         "over": metrics["swap_pct"] >= settings.SERVER_ALERT_SWAP_PCT and swap_gated,
         "detail": (f"메모리 {metrics['mem_pct']}% 와 함께 높음 — 메모리 부족"
                    if swap_gated else
                    f"메모리가 {metrics['mem_pct']}% 라 정상 범위 (참고용)")},
        {"key": "disk", "label": "디스크 사용률",
         "value": metrics["disk_pct"], "limit": settings.SERVER_ALERT_DISK_PCT, "unit": "%",
         "over": metrics["disk_pct"] >= settings.SERVER_ALERT_DISK_PCT,
         "detail": f"{metrics['disk_used_gb']}GB / {metrics['disk_total_gb']}GB"},
        {"key": "traffic", "label": "오늘 트래픽",
         "value": traffic_gb, "limit": settings.SERVER_ALERT_TRAFFIC_GB, "unit": "GB",
         "over": traffic_gb >= settings.SERVER_ALERT_TRAFFIC_GB,
         "detail": "하루 20GB 한도 기준 · 앱 컨테이너 추정치"},
    ]
    return checks


def evaluate(checks: List[Dict[str, Any]], state: Dict[str, Any],
             now_ts: Optional[float] = None) -> Dict[str, List[Dict[str, Any]]]:
    """상태를 갱신하고 '지금 보내야 할 것'을 가려낸다.

    반환: {"breach": [...알림 보낼 항목...], "recover": [...회복 알림...]}
    """
    now_ts = now_ts if now_ts is not None else time.time()
    interval = max(1, settings.SERVER_ALERT_INTERVAL_SEC)
    need_streak = max(1, round(settings.SERVER_ALERT_SUSTAIN_MIN * 60 / interval))
    cooldown = settings.SERVER_ALERT_COOLDOWN_MIN * 60

    streaks: Dict[str, int] = state.setdefault("streaks", {})
    last_sent: Dict[str, float] = state.setdefault("last_sent", {})
    firing: List[str] = state.setdefault("firing", [])

    breach, recover = [], []
    for c in checks:
        # over 는 build_checks 가 정한다(스왑처럼 다른 항목과 함께 봐야 하는 게 있어서)
        over = c.get("over", c["value"] >= c["limit"])
        if over:
            streaks[c["key"]] = streaks.get(c["key"], 0) + 1
            c["streak"] = streaks[c["key"]]
            c["need"] = need_streak
            if streaks[c["key"]] >= need_streak:
                # 보낸 적이 없으면(None) 쿨다운을 따지지 않고 바로 보낸다.
                # 0을 '안 보냄'으로 쓰면 쿨다운이 현재 시각의 절대값에 휘둘린다.
                last = last_sent.get(c["key"])
                if last is None or (now_ts - last) >= cooldown:
                    last_sent[c["key"]] = now_ts
                    breach.append(c)
                    if c["key"] not in firing:
                        firing.append(c["key"])
        else:
            streaks[c["key"]] = 0
            if c["key"] in firing:      # 넘었다가 정상으로 돌아온 항목
                firing.remove(c["key"])
                last_sent.pop(c["key"], None)   # 다음에 또 넘으면 쿨다운 없이 바로 알린다
                recover.append(c)

    return {"breach": breach, "recover": recover}


# ──────────────────────────────────────────────────────────────
# 상태 파일 (워커 재기동에도 쿨다운이 유지되도록)
# ──────────────────────────────────────────────────────────────
def load_state(path: Optional[str] = None) -> Dict[str, Any]:
    path = path or settings.SERVER_ALERT_STATE_FILE
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def save_state(state: Dict[str, Any], path: Optional[str] = None) -> None:
    path = path or settings.SERVER_ALERT_STATE_FILE
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False)
        os.replace(tmp, path)          # 쓰다 만 파일이 남지 않게 원자적 교체
    except OSError as e:
        logger.warning("server_monitor: 상태 저장 실패 %s", e)


def acquire_leader(state: Dict[str, Any], now_ts: Optional[float] = None) -> bool:
    """워커 2개 중 하나만 감시역을 맡는다 — 같은 알림이 두 통 가지 않게."""
    now_ts = now_ts if now_ts is not None else time.time()
    me = f"{socket.gethostname()}:{os.getpid()}"
    owner, seen = state.get("leader"), state.get("leader_seen", 0)
    if owner and owner != me and (now_ts - seen) < _LEADER_TTL_SEC:
        return False
    state["leader"] = me
    state["leader_seen"] = now_ts
    return True


# ──────────────────────────────────────────────────────────────
# 메일
# ──────────────────────────────────────────────────────────────
def _row(c: Dict[str, Any], danger: bool) -> str:
    color = "#dc2626" if danger else "#059669"
    return (
        f'<tr>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700">{c["label"]}</td>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;color:{color};font-weight:800">'
        f'{c["value"]}{c["unit"]}</td>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888">'
        f'기준 {c["limit"]}{c["unit"]}</td>'
        f'<td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888;font-size:12px">'
        f'{c.get("detail","")}</td>'
        f'</tr>'
    )


def render_alert(kind: str, hit: List[Dict[str, Any]], checks: List[Dict[str, Any]],
                 metrics: Dict[str, Any]) -> Dict[str, str]:
    """kind: 'breach' | 'recover' | 'test'"""
    names = ", ".join(c["label"] for c in hit) or "전체 정상"
    if kind == "breach":
        subject = f"[서버 경고] {names} 임계치 초과"
        head, color = "서버 부하가 임계치를 넘었습니다", "#dc2626"
        lead = (f"아래 항목이 {settings.SERVER_ALERT_SUSTAIN_MIN}분 넘게 계속 기준을 초과했습니다. "
                f"같은 항목은 {settings.SERVER_ALERT_COOLDOWN_MIN}분에 한 번만 알립니다.")
    elif kind == "recover":
        subject = f"[서버 회복] {names} 정상으로 돌아왔습니다"
        head, color = "정상으로 돌아왔습니다", "#059669"
        lead = "앞서 알려드린 항목이 기준 아래로 내려왔습니다."
    else:
        subject = "[서버 알림] 테스트 메일"
        head, color = "테스트 메일입니다", "#2563eb"
        lead = "이 메일이 도착했다면 서버 부하 알림이 정상적으로 설정된 것입니다."

    rows = "".join(_row(c, c.get("over", c["value"] >= c["limit"])) for c in checks)
    html = f"""
    <div style="font-family:-apple-system,'Malgun Gothic',sans-serif;max-width:640px;margin:0 auto">
      <div style="border-left:5px solid {color};padding:12px 16px;background:#fafafa;border-radius:8px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">{head}</h2>
        <p style="margin:0;color:#666;font-size:13px">{lead}</p>
      </div>
      <p style="color:#888;font-size:12px;margin:14px 0 6px">
        측정 시각 {metrics.get('at','')} · 서버 사양 2 vCPU / {metrics.get('mem_total_gb','?')}GB RAM /
        SSD {metrics.get('disk_total_gb','?')}GB / 일 20GB 트래픽
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f4f4f5">
          <th style="text-align:left;padding:8px 10px">항목</th>
          <th style="text-align:left;padding:8px 10px">현재</th>
          <th style="text-align:left;padding:8px 10px">기준</th>
          <th style="text-align:left;padding:8px 10px">비고</th>
        </tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="color:#aaa;font-size:11px;margin-top:16px">
        행복한요양원 서버 감시 · 기준값은 backend 환경변수(SERVER_ALERT_*)로 조정할 수 있습니다.
      </p>
    </div>"""

    text = f"{head}\n{lead}\n\n" + "\n".join(
        f"- {c['label']}: {c['value']}{c['unit']} (기준 {c['limit']}{c['unit']}) {c.get('detail','')}"
        for c in checks)
    return {"subject": subject, "html": html, "text": text}


async def send_alert(kind: str, hit: List[Dict[str, Any]], checks: List[Dict[str, Any]],
                     metrics: Dict[str, Any]) -> bool:
    to = _recipients()
    if not to:
        logger.warning("server_monitor: 받는 사람이 없습니다 (SERVER_ALERT_TO)")
        return False
    from app.services.email_service import send_email
    body = render_alert(kind, hit, checks, metrics)
    try:
        await send_email(to=to, subject=body["subject"], html=body["html"], text=body["text"])
        logger.info("server_monitor: %s 메일 발송 → %s", kind, ", ".join(to))
        return True
    except Exception as e:                    # 메일이 실패해도 감시는 계속 돌아야 한다
        logger.error("server_monitor: 메일 발송 실패 %s: %s", type(e).__name__, e)
        return False


# ──────────────────────────────────────────────────────────────
# 감시 루프
# ──────────────────────────────────────────────────────────────
def snapshot() -> Dict[str, Any]:
    """현재 상태 한 번 보기 — 관리자 화면·테스트 메일에서 쓴다."""
    metrics = collect_metrics(cpu_interval=0.5)
    if not metrics.get("available"):
        return {"available": False}
    state = load_state()
    traffic = round(state.get("traffic_bytes", 0) / GB, 2)
    checks = build_checks(metrics, traffic)
    return {"available": True, "metrics": metrics, "checks": checks,
            "over": [c["key"] for c in checks if c.get("over")]}


def should_monitor() -> tuple[bool, str]:
    """감시를 돌려야 하는 환경인지 — 개발용 노트북에서 켜지지 않게."""
    if not settings.SERVER_ALERT_ENABLED:
        return False, "SERVER_ALERT_ENABLED=false"
    if settings.ENVIRONMENT != "production" and not settings.SERVER_ALERT_FORCE:
        # 여기서 막지 않으면 개발 PC의 CPU·스왑으로 경고 메일이 날아온다
        return False, f"운영 환경이 아님 (ENVIRONMENT={settings.ENVIRONMENT}) — 켜려면 SERVER_ALERT_FORCE=true"
    if not _recipients():
        return False, "SERVER_ALERT_TO 가 비어 있음"
    return True, ""


async def monitor_loop() -> None:
    ok, why = should_monitor()
    if not ok:
        logger.info("server_monitor: 감시하지 않음 — %s", why)
        return

    logger.info("🩺 서버 부하 감시 시작 — %s초마다 점검, 수신 %s",
                settings.SERVER_ALERT_INTERVAL_SEC, ", ".join(_recipients()))

    while True:
        try:
            await asyncio.sleep(settings.SERVER_ALERT_INTERVAL_SEC)

            state = load_state()
            if not acquire_leader(state):
                continue                       # 다른 워커가 감시 중

            # CPU 측정은 블로킹이라 별도 스레드에서 — 이벤트 루프를 1초 세우지 않는다
            metrics = await asyncio.to_thread(collect_metrics, 1.0)
            if not metrics.get("available"):
                logger.warning("server_monitor: psutil 이 없어 감시를 멈춥니다")
                return

            traffic = accumulate_traffic(state, metrics)
            checks = build_checks(metrics, traffic)
            result = evaluate(checks, state)
            save_state(state)

            if result["breach"]:
                await send_alert("breach", result["breach"], checks, metrics)
            if result["recover"]:
                await send_alert("recover", result["recover"], checks, metrics)

            # 방송 PC 감시도 이 루프에 얹는다 — 리더 선출·주기를 두 번 만들지 않으려고.
            # 판단은 broadcast_watch 가 하고, 여기서는 부르기만 한다.
            try:
                from app.core.database import SessionLocal
                from app.services import broadcast_watch
                db = SessionLocal()
                try:
                    alerts = broadcast_watch.evaluate(db, state, time.time())
                finally:
                    db.close()
                if alerts:
                    save_state(state)
                    await broadcast_watch.notify(alerts)
            except Exception as e:
                logger.warning("방송 PC 감시 오류: %s: %s", type(e).__name__, e)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("server_monitor tick error: %s: %s", type(e).__name__, e)
            await asyncio.sleep(60)
