"""Broadcast Agent — 요양원 방송 PC에서 24시간 돈다.

하는 일은 단순하다.
  1) 서버에 살아있다고 알린다(heartbeat) + 시킬 일이 있으면 받아온다
  2) 앞으로 며칠치 '몇 시에 무엇을' 목록을 받아 로컬에 저장한다
  3) 음원을 미리 받아 캐시에 둔다
  4) 시간이 되면 서버에 '내가 튼다'고 알리고(claim) 재생한다
  5) 결과를 보고한다

설계에서 지킨 것
  · 인터넷이 끊겨도 이미 받아둔 예약은 나간다. 동기화 결과를 파일로 저장하고,
    음원도 미리 받아두기 때문이다. 다만 claim 은 서버가 필요하므로,
    오프라인일 때는 로컬 기록으로 중복을 막고 복구되면 결과를 밀어 보낸다.
  · 재부팅해도 캐시와 실행기록이 파일에 남아 그대로 이어간다.
  · 같은 회차를 두 번 틀지 않는다 — 로컬 기록 + 서버 claim 두 겹으로 막는다.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import socket
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import urllib.error
import urllib.request

from broadcast_agent.output import BroadcastOutput, build_output, ZONE_ALL

KST = timezone(timedelta(hours=9))
logger = logging.getLogger("broadcast-agent")

AGENT_VERSION = "1.0.0"


def now_kst() -> datetime:
    return datetime.now(KST)


def local_ip() -> str:
    """이 PC 의 원내 網 주소.

    서버는 이 IP 로 접속하지 않는다(통신은 항상 PC → 서버). 사람이 나중에
    원격 접속하거나 '어느 PC인지' 찾을 때 쓰라고 알려주는 값이다.

    UDP 소켓을 열어 커널이 고른 출발지 주소를 읽는다 — 실제 패킷은 나가지 않고,
    인터넷이 끊겨 있어도 라우팅 테이블만 있으면 답이 나온다.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return ""
    finally:
        s.close()


def parse_at(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=KST) if dt.tzinfo is None else dt.astimezone(KST)


# ──────────────────────────────────────────────────────────────
# 서버 통신 — 실패해도 죽지 않는다
# ──────────────────────────────────────────────────────────────
class ServerError(RuntimeError):
    pass


class ApiClient:
    def __init__(self, base_url: str, token: Optional[str] = None, timeout: int = 20):
        self.base = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _req(self, method: str, path: str, body: Optional[dict] = None) -> dict:
        url = f"{self.base}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("X-Device-Token", self.token)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = json.loads(e.read().decode("utf-8")).get("detail", "")
            except Exception:
                pass
            raise ServerError(f"HTTP {e.code} {detail}") from e
        except Exception as e:                      # 네트워크 단절 등
            raise ServerError(f"{type(e).__name__}: {e}") from e
        if not payload.get("success"):
            raise ServerError(payload.get("message") or payload.get("error") or "요청 실패")
        return payload.get("data") or {}

    def register(self, enroll_code: str, device_id: str, name: str, output_name: str = "") -> dict:
        return self._req("POST", "/api/v1/broadcast-agent/register", {
            "enroll_code": enroll_code, "device_id": device_id, "name": name,
            "version": AGENT_VERSION, "output_name": output_name,
            "hostname": socket.gethostname(), "local_ip": local_ip()})

    def heartbeat(self, now_playing: Optional[str], output_name: str = "",
                  clock_skew_sec: float = 0.0) -> dict:
        # 호스트명·내부 IP를 함께 알린다 — 관리자가 그 PC를 찾아갈 수 있게.
        # 공유기에서 IP가 바뀌어도 다음 heartbeat 에 최신 값으로 갱신된다.
        return self._req("POST", "/api/v1/broadcast-agent/heartbeat", {
            "now_playing": now_playing, "version": AGENT_VERSION, "output_name": output_name,
            "hostname": socket.gethostname(), "local_ip": local_ip(),
            "clock_skew_sec": round(clock_skew_sec, 1)})

    def sync(self) -> dict:
        return self._req("GET", "/api/v1/broadcast-agent/sync")

    def claim(self, schedule_id: str, occurrence_at: str) -> dict:
        return self._req("POST", "/api/v1/broadcast-agent/claim", {
            "schedule_id": schedule_id, "occurrence_at": occurrence_at})

    def report(self, run_id: Optional[str], status: str, started_at: str = None,
               ended_at: str = None, error: str = None,
               schedule_id: str = None, occurrence_at: str = None,
               offline: bool = False) -> dict:
        return self._req("POST", "/api/v1/broadcast-agent/report", {
            "run_id": run_id, "schedule_id": schedule_id, "occurrence_at": occurrence_at,
            "status": status, "started_at": started_at,
            "ended_at": ended_at, "error_message": error, "offline": offline})

    def download(self, url: str, dest: str) -> None:
        full = url if url.startswith("http") else f"{self.base}{url}"
        req = urllib.request.Request(full)
        if self.token:
            req.add_header("X-Device-Token", self.token)
        tmp = dest + ".part"
        with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
            while True:
                chunk = r.read(64 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        os.replace(tmp, dest)          # 받다 만 파일을 재생하지 않도록 원자적 교체


# ──────────────────────────────────────────────────────────────
# 로컬 상태 — 재부팅·단절을 견디는 부분
# ──────────────────────────────────────────────────────────────
class LocalStore:
    """예약 캐시·실행기록·보고 대기열을 파일로 남긴다."""

    def __init__(self, data_dir: str):
        self.dir = data_dir
        self.media_dir = os.path.join(data_dir, "media")
        os.makedirs(self.media_dir, exist_ok=True)
        self.schedule_path = os.path.join(data_dir, "schedule.json")
        self.state_path = os.path.join(data_dir, "state.json")

    def _read(self, path: str, default):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return default

    def _write(self, path: str, obj) -> None:
        tmp = path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False)
            os.replace(tmp, path)
        except OSError as e:
            logger.warning("저장 실패 %s: %s", path, e)

    # 예약 캐시 — 인터넷이 끊겨도 이걸 보고 방송한다
    def save_schedule(self, payload: dict) -> None:
        payload = dict(payload)
        payload["_saved_at"] = now_kst().isoformat()
        self._write(self.schedule_path, payload)

    def load_schedule(self) -> dict:
        return self._read(self.schedule_path, {"items": []})

    # 실행 기록 — 같은 회차를 두 번 틀지 않기 위한 로컬 방어선
    def state(self) -> dict:
        return self._read(self.state_path, {"done": {}, "pending_reports": []})

    def save_state(self, st: dict) -> None:
        self._write(self.state_path, st)

    @staticmethod
    def key(schedule_id: str, occurrence_at: str) -> str:
        return f"{schedule_id}|{occurrence_at}"

    def is_done(self, schedule_id: str, occurrence_at: str) -> bool:
        return self.key(schedule_id, occurrence_at) in self.state().get("done", {})

    def mark_done(self, schedule_id: str, occurrence_at: str, status: str) -> None:
        st = self.state()
        st.setdefault("done", {})[self.key(schedule_id, occurrence_at)] = {
            "status": status, "at": now_kst().isoformat()}
        # 오래된 기록은 정리한다 — 파일이 무한정 커지지 않게
        cutoff = (now_kst() - timedelta(days=30)).isoformat()
        st["done"] = {k: v for k, v in st["done"].items() if v.get("at", "") >= cutoff}
        self.save_state(st)

    def queue_report(self, item: dict) -> None:
        st = self.state()
        st.setdefault("pending_reports", []).append(item)
        self.save_state(st)

    def take_reports(self) -> List[dict]:
        st = self.state()
        items = st.get("pending_reports", [])
        st["pending_reports"] = []
        self.save_state(st)
        return items

    # 음원 캐시
    def media_path(self, filename: str) -> str:
        return os.path.join(self.media_dir, os.path.basename(filename))

    def has_media(self, filename: str, sha256: Optional[str]) -> bool:
        p = self.media_path(filename)
        if not os.path.exists(p):
            return False
        if not sha256:
            return True
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        return h.hexdigest() == sha256      # 내용이 바뀌었으면 다시 받는다


# ──────────────────────────────────────────────────────────────
# Agent
# ──────────────────────────────────────────────────────────────
class BroadcastAgent:
    def __init__(self, cfg: dict, output: Optional[BroadcastOutput] = None,
                 api: Optional[ApiClient] = None, store: Optional[LocalStore] = None):
        self.cfg = cfg
        self.device_id = cfg["device_id"]
        self.store = store or LocalStore(cfg["data_dir"])
        self.api = api or ApiClient(cfg["server_url"], cfg.get("device_token"))
        self.output = output or build_output(
            cfg.get("output_kind", "audio"),
            device_name=cfg.get("audio_device"),
            driver=cfg.get("audio_driver"),
        )
        self.heartbeat_sec = int(cfg.get("heartbeat_sec", 30))
        self.sync_sec = int(cfg.get("sync_sec", 300))
        # 예정 시각 ±이 범위 안이면 '지금 틀 시간'으로 본다
        self.tolerance_sec = int(cfg.get("tolerance_sec", 90))
        # 즉시 방송은 조금 늦게 받아도 내보낸다(서버의 15분 한도와 맞춤).
        # 예약 방송은 좁게 유지한다 — 3시간 전 점심 안내가 갑자기 나가면 안 된다.
        self.immediate_tolerance_sec = int(cfg.get("immediate_tolerance_sec", 900))
        self._stop = threading.Event()
        self._last_sync = 0.0
        self.online = False
        self.now_playing: Optional[str] = None
        # 서버 시계와의 차이(초). PC 시계가 느리면 음수.
        # 방송 시각 판단에 이 값을 반영한다 — 안 그러면 시계가 틀어진 만큼 늦게/일찍 나간다.
        self.clock_skew = 0.0

    # ── 동기화 ──
    def sync(self) -> bool:
        try:
            data = self.api.sync()
        except ServerError as e:
            self.online = False
            logger.warning("동기화 실패(캐시로 계속 진행): %s", e)
            return False
        self.online = True
        self.store.save_schedule(data)
        self.prefetch(data.get("items", []))
        logger.info("동기화 완료 — 예약 %d건", len(data.get("items", [])))
        return True

    def prefetch(self, items: List[dict]) -> None:
        """음원을 미리 받아둔다 — 방송 시간에 다운로드하고 있으면 늦는다."""
        seen = set()
        for it in items:
            m = it.get("media") or {}
            fn, url = m.get("filename"), m.get("url")
            if not fn or not url or fn in seen:
                continue
            seen.add(fn)
            if self.store.has_media(fn, m.get("sha256")):
                continue
            try:
                self.api.download(url, self.store.media_path(fn))
                logger.info("음원 내려받음: %s", fn)
            except Exception as e:
                logger.warning("음원 내려받기 실패 %s: %s", fn, e)

    # ── 명령 ──
    def heartbeat(self) -> None:
        try:
            data = self.api.heartbeat(self.now_playing, self.cfg.get("audio_device") or "",
                                      self.clock_skew)
            self.online = True
            self._check_clock(data.get("server_time"))
            for cmd in data.get("commands", []):
                self.handle_command(cmd)
        except ServerError as e:
            self.online = False
            logger.debug("heartbeat 실패: %s", e)

    def _check_clock(self, server_time: Optional[str]) -> None:
        """이 PC 시계가 서버와 얼마나 다른지 본다.

        방송은 '몇 시 몇 분'에 나가야 하는 일이라 시계가 틀어지면 그만큼 어긋난다.
        어느 쪽이 틀렸는지는 기계가 알 수 없으므로 임의로 보정하지 않고,
        차이를 재서 알린다. 값은 서버로도 보내 관리자 화면에 표시된다.
        근본 해결은 양쪽 다 시간 동기화(NTP)를 켜는 것이다.
        """
        if not server_time:
            return
        try:
            skew = (parse_at(server_time) - now_kst()).total_seconds()
        except (ValueError, TypeError):
            return
        # 몇 시간씩 차이 나면 서버 응답이 이상한 것일 수 있다 — 보정하지 않고 알리기만
        if abs(skew) > 6 * 3600:
            logger.error("시계 차이가 너무 큽니다(%.0f초). PC 시간을 확인하세요.", skew)
            return
        was = self.clock_skew
        self.clock_skew = skew
        if abs(skew) >= 30 and abs(skew - was) >= 5:
            logger.warning(
                "시계가 서버와 %.0f초 어긋나 있습니다(서버가 %s). "
                "예약 방송은 이 PC 시계를 기준으로 내보냅니다. "
                "양쪽 모두 시간 동기화(NTP)를 확인해주세요.",
                abs(skew), "빠름" if skew > 0 else "느림")

    def server_now(self) -> datetime:
        """서버 시계 기준 현재 시각 — 진단·표시용.

        방송 시각 판단에는 쓰지 않는다. 서버 시계가 틀어져 있을 수 있고,
        '몇 시에 방송'을 지켜야 하는 곳은 현장이기 때문이다.
        """
        return now_kst() + timedelta(seconds=self.clock_skew)

    def handle_command(self, cmd: dict) -> None:
        name = cmd.get("command")
        if name in ("STOP", "EMERGENCY_STOP"):
            logger.warning("중지 명령 수신 — 재생을 끊습니다")
            self.output.stop()
        elif name == "RESYNC":
            self._last_sync = 0.0

    # ── 재생 ──
    def due_items(self, at: Optional[datetime] = None) -> List[dict]:
        """지금 틀어야 할 회차들.

        두 종류를 다르게 다룬다. 서버와 이 PC 의 시계가 어긋나 있을 때
        무엇이 옳은 동작인지가 서로 다르기 때문이다.

        · 예약 방송("11시 50분 점심 안내")은 벽시계 약속이다. 그 시각을 지켜야 하는
          곳은 현장이므로 **이 PC 의 시계**를 기준으로 판단한다. 서버 시계가
          몇 분 틀어져 있어도 방송은 제 시각에 나간다.
          창을 좁게(기본 90초) 둬서 지나간 안내가 뒤늦게 튀어나오지 않게 한다.

        · 즉시 방송(관리자가 방금 누른 것)은 '가능한 한 빨리'가 목적이고,
          찍힌 시각은 서버가 남긴 표식일 뿐이다. 그래서 앞뒤 양쪽으로 넓게 본다.
          서버 시계가 빠르면 그 시각이 미래로 보이는데, 그때 기다리면
          누른 사람 입장에서는 몇 분씩 늦게 나가는 것이 된다.
        """
        at = at or now_kst()
        out = []
        for it in self.store.load_schedule().get("items", []):
            try:
                when = parse_at(it["occurrence_at"])
            except Exception:
                continue
            diff = (at - when).total_seconds()
            if it.get("immediate"):
                due = abs(diff) <= self.immediate_tolerance_sec      # 앞뒤 모두 허용
            else:
                due = 0 <= diff <= self.tolerance_sec                # 지난 뒤 잠깐만
            if due and not self.store.is_done(it["schedule_id"], it["occurrence_at"]):
                out.append(it)
        return out

    def run_item(self, item: dict) -> str:
        """한 회차를 재생한다. 반환은 최종 상태."""
        sid, occ = item["schedule_id"], item["occurrence_at"]
        # 1차 방어선: 로컬 기록 (오프라인이어도 중복을 막는다)
        if self.store.is_done(sid, occ):
            return "SKIPPED"

        # 2차 방어선: 서버 claim. 방송 PC가 여러 대여도 한 대만 통과한다.
        run_id = None
        try:
            res = self.api.claim(sid, occ)
            if not res.get("granted"):
                logger.info("건너뜀(%s): %s", item.get("title"), res.get("reason"))
                self.store.mark_done(sid, occ, "SKIPPED")
                return "SKIPPED"
            run_id = res.get("run_id")
            self.online = True
        except ServerError as e:
            self.online = False
            if not self.cfg.get("offline_play", True):
                logger.warning("claim 실패 — offline_play 가 꺼져 있어 건너뜁니다: %s", e)
                return "SKIPPED"
            # 인터넷이 끊겼다. 이미 받아둔 예약이므로 예정대로 튼다 —
            # 중복은 로컬 기록으로 막고, 결과는 복구되면 밀어 보낸다.
            logger.warning("claim 실패(오프라인) — 로컬 기록으로 진행: %s", e)

        m = item.get("media") or {}
        path = self.store.media_path(m.get("filename", ""))
        started = now_kst()
        self.now_playing = item.get("title")
        try:
            result = self.output.play(
                path, volume=int(item.get("volume", 70)),
                max_seconds=int(item.get("max_seconds", 600)),
                zones=item.get("zones") or [ZONE_ALL])
        except Exception as e:
            result = type("R", (), {"ok": False, "error": f"{type(e).__name__}: {e}",
                                    "seconds": 0.0, "truncated": False})()
        finally:
            self.now_playing = None
        ended = now_kst()

        status = "SUCCESS" if result.ok else "FAILED"
        if status == "SUCCESS":
            self.store.mark_done(sid, occ, status)
        # 실패는 '완료'로 찍지 않는다 — 다음 주기에 다시 시도할 수 있게 남겨둔다
        # (무한 재시도는 서버가 attempt 로 끊는다)
        if getattr(result, "truncated", False):
            logger.warning("최대 방송시간 초과로 중단: %s", item.get("title"))

        # run_id 가 없으면(오프라인 재생) 회차 좌표로 보고한다.
        # 안 그러면 끊겼을 때 나간 방송이 서버 기록에 영영 안 남는다.
        payload = {"run_id": run_id, "schedule_id": sid, "occurrence_at": occ,
                   "status": status, "started_at": started.isoformat(),
                   "ended_at": ended.isoformat(),
                   "error": getattr(result, "error", None),
                   "offline": run_id is None}
        try:
            self.api.report(**payload)
        except ServerError as e:
            logger.warning("결과 보고 실패 — 연결되면 다시 보냅니다: %s", e)
            self.store.queue_report(payload)
        return status

    def flush_reports(self) -> int:
        """끊겼을 때 못 보낸 결과를 밀어 보낸다."""
        items = self.store.take_reports()
        sent = 0
        for p in items:
            try:
                self.api.report(**p)
                sent += 1
            except ServerError:
                self.store.queue_report(p)      # 아직도 안 되면 다시 넣어둔다
                break
        return sent

    # ── 메인 루프 ──
    def tick(self, at: Optional[datetime] = None) -> List[str]:
        results = []
        for item in self.due_items(at):
            results.append(self.run_item(item))
        return results

    def _heartbeat_loop(self) -> None:
        """heartbeat 는 반드시 독립 스레드에서 돈다.

        재생(tick)과 음원 내려받기(sync)는 끝날 때까지 블로킹한다.
        같은 스레드에서 돌리면 3분짜리 방송이 나가는 동안 heartbeat 이 멈추고,
        서버는 그 PC 를 오프라인으로 표시한다. 「즉시 중지」 명령도 방송이
        끝난 뒤에야 도착해서 아무 소용이 없다.

        분리해두면 방송 중에도 살아있음이 계속 전달되고, 중지 명령이
        재생 도중에 도착해 output.stop() 을 부를 수 있다.
        """
        while not self._stop.is_set():
            try:
                self.heartbeat()
            except Exception as e:                  # 어떤 이유로도 이 스레드는 죽으면 안 된다
                logger.warning("heartbeat 오류: %s: %s", type(e).__name__, e)
            self._stop.wait(self.heartbeat_sec)

    def run_forever(self) -> None:
        logger.info("Broadcast Agent 시작 — device=%s, 출력=%s",
                    self.device_id, self.output.name)
        h = self.output.health_check()
        logger.info("출력 점검: %s (%s)", "정상" if h.ok else "문제", h.detail)

        hb = threading.Thread(target=self._heartbeat_loop, name="heartbeat", daemon=True)
        hb.start()

        while not self._stop.is_set():
            try:
                now = time.time()
                if now - self._last_sync >= self.sync_sec:
                    self.sync()
                    self.flush_reports()
                    self._last_sync = now
                self.tick()
            except Exception as e:                  # 어떤 예외로도 멈추면 안 된다
                logger.exception("루프 오류: %s", e)
            self._stop.wait(5)                      # 5초마다 확인 — 정시 오차를 줄인다
        hb.join(timeout=5)
        logger.info("Broadcast Agent 종료")

    def stop(self) -> None:
        self._stop.set()
        self.output.stop()
