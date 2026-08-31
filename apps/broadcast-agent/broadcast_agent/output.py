"""방송 출력 — 하드웨어 추상화 계층.

지금은 PC 오디오 출력이 BKH-180 의 LINE/AUX 로 들어가 100V 실링스피커로 나간다.
나중에 Zone 컨트롤러나 네트워크 PA 로 바뀌어도 Admin·예약·TTS 는 그대로여야 한다.
그래서 '소리를 내는 방법'을 이 인터페이스 뒤에 가둔다.

    output = build_output(config)     # 설정에 따라 구현체가 결정된다
    output.play(path, volume=70, max_seconds=600, zones=["ALL"])

구현체:
  AudioOutputAdapter  — 지금 쓰는 것. PC 오디오 → BKH-180
  MockAudioOutput     — 앰프 없이 테스트할 때. 실제로 기다리기만 한다
  ZoneControllerAdapter / NetworkPAAdapter — 자리만 잡아둔다.
      하드웨어가 정해지지 않았으므로 지어내지 않고, 부르면 분명히 거절한다.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

ZONE_ALL = "ALL"


class OutputError(RuntimeError):
    """재생 실패 — 서버에 그대로 보고할 문장."""


@dataclass
class PlayResult:
    ok: bool
    seconds: float
    error: Optional[str] = None
    truncated: bool = False        # 최대 방송시간에 걸려 끊겼는지


@dataclass
class HealthStatus:
    ok: bool
    detail: str
    device: Optional[str] = None
    zones: List[str] = field(default_factory=lambda: [ZONE_ALL])


class BroadcastOutput(ABC):
    """방송을 내보내는 장치 한 대."""

    name = "base"

    @abstractmethod
    def play(self, path: str, *, volume: int = 70, max_seconds: int = 600,
             zones: Optional[List[str]] = None) -> PlayResult:
        ...

    @abstractmethod
    def stop(self) -> None:
        """지금 나가는 방송을 즉시 끊는다."""

    @abstractmethod
    def set_volume(self, volume: int) -> None:
        ...

    @abstractmethod
    def select_zones(self, zones: List[str]) -> List[str]:
        """실제로 선택된 구역을 돌려준다. 못 하는 건 못 한다고 답해야 한다."""

    @abstractmethod
    def health_check(self) -> HealthStatus:
        ...

    @property
    def is_playing(self) -> bool:
        return False


class MockAudioOutput(BroadcastOutput):
    """앰프 없이 전체 흐름을 검증하기 위한 출력.

    소리는 안 나지만 '재생 중' 상태와 소요 시간, 중지, 최대시간 초과를
    실제와 똑같이 흉내낸다. 그래야 E2E 테스트가 의미가 있다.
    """

    name = "mock"

    def __init__(self, *, speed: float = 1.0, fixed_seconds: Optional[float] = None):
        self.speed = speed                    # 테스트를 빠르게 돌리려고 시간을 압축
        self.fixed_seconds = fixed_seconds
        self.volume = 70
        self.zones = [ZONE_ALL]
        self._stop = threading.Event()
        self._playing = False
        self.played: List[dict] = []          # 무엇을 몇 번 틀었는지 — 검증용

    @property
    def is_playing(self) -> bool:
        return self._playing

    def play(self, path, *, volume=70, max_seconds=600, zones=None,
             _no_format=False) -> PlayResult:
        retried = _no_format
        if not os.path.exists(path):
            return PlayResult(ok=False, seconds=0.0, error=f"파일이 없습니다: {path}")
        self.volume = volume
        self.zones = self.select_zones(zones or [ZONE_ALL])
        dur = self.fixed_seconds if self.fixed_seconds is not None else 0.05
        self._stop.clear()
        self._playing = True
        t0 = time.time()
        truncated = False
        try:
            deadline = min(dur, max_seconds)
            if self._stop.wait(timeout=deadline / max(self.speed, 0.001)):
                return PlayResult(ok=True, seconds=time.time() - t0, error="중지됨")
            if dur > max_seconds:
                truncated = True
        finally:
            self._playing = False
        self.played.append({"path": path, "volume": volume, "zones": self.zones})
        return PlayResult(ok=True, seconds=time.time() - t0, truncated=truncated)

    def stop(self) -> None:
        self._stop.set()

    def set_volume(self, volume: int) -> None:
        self.volume = max(0, min(100, int(volume)))

    def select_zones(self, zones):
        # 실제 장비와 똑같이 — 구역 분리 장비가 없으면 전체로만 나간다
        return [ZONE_ALL]

    def health_check(self) -> HealthStatus:
        return HealthStatus(ok=True, detail="모의 출력(소리 없음)", device="mock", zones=[ZONE_ALL])


class ZoneControllerAdapter(BroadcastOutput):
    """구역별 방송 장비용 자리 — 아직 장비가 없다.

    임의로 구현하면 '되는 줄 알았는데 안 되는' 기능이 된다.
    장비가 정해지면 이 클래스만 채우면 된다.
    """

    name = "zone_controller"

    def _nope(self):
        raise OutputError("구역 컨트롤러가 연결되지 않았습니다. (현재는 전체 방송만 가능)")

    def play(self, path, *, volume=70, max_seconds=600, zones=None): self._nope()
    def stop(self): self._nope()
    def set_volume(self, volume): self._nope()
    def select_zones(self, zones): self._nope()
    def health_check(self) -> HealthStatus:
        return HealthStatus(ok=False, detail="구역 컨트롤러 미연결", zones=[])


class NetworkPAAdapter(BroadcastOutput):
    """네트워크 PA(IP 스피커)용 자리 — 아직 장비가 없다."""

    name = "network_pa"

    def _nope(self):
        raise OutputError("네트워크 PA 장비가 연결되지 않았습니다.")

    def play(self, path, *, volume=70, max_seconds=600, zones=None): self._nope()
    def stop(self): self._nope()
    def set_volume(self, volume): self._nope()
    def select_zones(self, zones): self._nope()
    def health_check(self) -> HealthStatus:
        return HealthStatus(ok=False, detail="네트워크 PA 미연결", zones=[])


# 확장자 → ffmpeg 디먹서 이름. 형식 추측이 빗나가 소리 없이 끝나는 것을 막는다.
DEMUXER = {".mp3": "mp3", ".wav": "wav", ".m4a": "mp4",
           ".mp4": "mp4", ".aac": "aac", ".ogg": "ogg"}


class AudioOutputAdapter(BroadcastOutput):
    """PC 오디오 출력 → BKH-180 LINE/AUX → 100V 실링스피커.

    재생은 ffplay(ffmpeg 동봉)에 맡긴다. 이유가 있다:
      - mp3/wav/m4a/mp4 를 코덱 걱정 없이 그대로 튼다 (mp4 는 -vn 으로 소리만)
      - 볼륨을 필터로 정확히 건다
      - 프로세스를 죽이면 즉시 멈춘다 → '즉시 중지'가 확실하다
      - Windows·Linux 동일하게 동작한다

    출력장치는 설정으로 고른다. USB DAC 을 꽂았을 때 그쪽으로 나가야 하기 때문이다.
      Windows : device_name 에 장치 이름 (SDL 오디오 장치명)
      Linux   : device_name 에 ALSA 장치 (예: 'plughw:1,0') 또는 PULSE 싱크명
    비워두면 OS 기본 출력으로 나간다.
    """

    name = "audio_out"

    def __init__(self, *, device_name: Optional[str] = None, driver: Optional[str] = None,
                 player: Optional[str] = None):
        self.device_name = (device_name or "").strip() or None
        self.driver = (driver or "").strip() or None      # 예: 'alsa', 'pulse', 'directsound'
        self.player = player or shutil.which("ffplay") or "ffplay"
        self.volume = 70
        self.zones = [ZONE_ALL]
        self._proc: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()

    # ── 도구 확인 ──
    def _player_ok(self) -> bool:
        return bool(shutil.which(self.player) or os.path.exists(self.player))

    def _env(self) -> dict:
        env = os.environ.copy()
        # ffplay 는 SDL 을 쓴다 — 드라이버/장치를 환경변수로 지정한다
        if self.driver:
            env["SDL_AUDIODRIVER"] = self.driver
        if self.device_name:
            env["SDL_AUDIODEVICE"] = self.device_name
            # ALSA 를 직접 쓸 때를 대비
            env.setdefault("AUDIODEV", self.device_name)
        return env

    @property
    def is_playing(self) -> bool:
        p = self._proc
        return bool(p and p.poll() is None)

    def play(self, path, *, volume=70, max_seconds=600, zones=None) -> PlayResult:
        if not os.path.exists(path):
            return PlayResult(ok=False, seconds=0.0, error=f"음원 파일이 없습니다: {path}")
        if not self._player_ok():
            return PlayResult(ok=False, seconds=0.0,
                              error="ffplay(ffmpeg)를 찾을 수 없습니다. 설치 후 PATH 에 넣어주세요.")
        self.set_volume(volume)
        self.zones = self.select_zones(zones or [ZONE_ALL])

        # -nodisp/-vn : mp4 라도 화면 없이 소리만. -autoexit : 끝나면 스스로 종료
        #
        # -f 로 형식을 못박는다. ffmpeg 은 내용을 보고 형식을 추측하는데, 태그도
        # 헤더도 없는 mp3 를 VVC 영상으로 잘못 짚은 일이 있었다. 그러면 -vn 이
        # 그 가짜 영상 트랙을 버리고 남는 오디오가 없어, 소리 한 번 안 내고
        # 종료코드 0 으로 끝난다 — 방송은 안 나갔는데 기록은 '성공'이 된다.
        # 추측에 맡기지 않는다.
        cmd = [self.player, "-nodisp", "-vn", "-autoexit", "-loglevel", "error"]
        fmt = None if _no_format else DEMUXER.get(os.path.splitext(path)[1].lower())
        if fmt:
            cmd += ["-f", fmt]
        cmd += ["-af", f"volume={self.volume / 100:.3f}", path]
        t0 = time.time()
        truncated = False
        try:
            with self._lock:
                self._proc = subprocess.Popen(cmd, env=self._env(),
                                              stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                _, err = self._proc.communicate(timeout=max_seconds)
                rc = self._proc.returncode
            except subprocess.TimeoutExpired:
                # 최대 방송시간 초과 — 무한 재생 사고를 여기서 끊는다
                truncated = True
                self._kill()
                return PlayResult(ok=True, seconds=time.time() - t0, truncated=True)
            if rc not in (0, None):
                msg = (err or b"").decode("utf-8", "ignore").strip()[:300]
                # 사람이 중지시킨 경우도 0이 아닌 코드로 끝난다
                if self._stopped_by_user:
                    return PlayResult(ok=True, seconds=time.time() - t0, error="중지됨")
                # 확장자가 거짓인 파일일 수 있다(m4a 를 .mp3 로 저장한 것 등).
                # 형식을 못박은 탓에 못 튼 거라면 한 번은 추측으로 되돌려 본다.
                if fmt and not retried:
                    logger.warning("%s 로 못 읽었습니다 — 형식 추측으로 다시 시도합니다", fmt)
                    return self.play(path, volume=volume, max_seconds=max_seconds,
                                     zones=zones, _no_format=True)
                return PlayResult(ok=False, seconds=time.time() - t0,
                                  error=msg or f"재생 실패(코드 {rc})")
            return PlayResult(ok=True, seconds=time.time() - t0, truncated=truncated)
        except Exception as e:
            return PlayResult(ok=False, seconds=time.time() - t0,
                              error=f"{type(e).__name__}: {e}")
        finally:
            with self._lock:
                self._proc = None
            self._stopped_by_user = False

    _stopped_by_user = False

    def _kill(self) -> None:
        with self._lock:
            p = self._proc
        if not p or p.poll() is not None:
            return
        try:
            p.terminate()
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()
        except Exception as e:
            logger.warning("재생 중지 실패: %s", e)

    def stop(self) -> None:
        self._stopped_by_user = True
        self._kill()

    def set_volume(self, volume: int) -> None:
        self.volume = max(0, min(100, int(volume)))

    def select_zones(self, zones):
        # BKH-180 에 구역 분리 입력이 없다 — 요청이 뭐든 전체로 나간다.
        # 여기서 거짓으로 부분 구역을 돌려주면 화면이 사실이 아닌 걸 표시하게 된다.
        return [ZONE_ALL]

    def health_check(self) -> HealthStatus:
        if not self._player_ok():
            return HealthStatus(ok=False, detail="ffplay(ffmpeg) 미설치", zones=[ZONE_ALL])
        return HealthStatus(ok=True,
                            detail="PC 오디오 출력 정상 (BKH-180 LINE/AUX 연결 확인 필요)",
                            device=self.device_name or "시스템 기본 출력", zones=[ZONE_ALL])


def list_output_devices() -> List[str]:
    """고를 수 있는 오디오 출력장치 이름들 — 설치할 때 USB DAC 을 찾기 위해.

    OS 마다 방법이 달라 가능한 것만 모은다. 못 찾으면 빈 목록이고,
    그때는 설정을 비워 OS 기본 출력을 쓰면 된다.
    """
    names: List[str] = []
    try:
        import sounddevice as sd            # 있으면 가장 정확하다
        for d in sd.query_devices():
            if d.get("max_output_channels", 0) > 0:
                names.append(d["name"])
        return names
    except Exception:
        pass
    if shutil.which("pactl"):               # Linux + PulseAudio
        try:
            out = subprocess.run(["pactl", "list", "short", "sinks"],
                                 capture_output=True, text=True, timeout=5)
            names += [l.split("\t")[1] for l in out.stdout.splitlines() if "\t" in l]
        except Exception:
            pass
    if shutil.which("aplay"):               # Linux + ALSA
        try:
            out = subprocess.run(["aplay", "-L"], capture_output=True, text=True, timeout=5)
            names += [l for l in out.stdout.splitlines() if l and not l.startswith(" ")]
        except Exception:
            pass
    return names


def build_output(kind: str = "audio", **kwargs) -> BroadcastOutput:
    """설정 문자열 하나로 출력 방식을 고른다 — 하드웨어가 바뀌면 여기만 바뀐다."""
    k = (kind or "audio").lower()
    if k in ("mock", "test"):
        return MockAudioOutput(**{x: kwargs[x] for x in ("speed", "fixed_seconds") if x in kwargs})
    if k in ("zone", "zone_controller"):
        return ZoneControllerAdapter()
    if k in ("network_pa", "pa"):
        return NetworkPAAdapter()
    return AudioOutputAdapter(
        device_name=kwargs.get("device_name"),
        driver=kwargs.get("driver"),
        player=kwargs.get("player"),
    )
