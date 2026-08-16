"""방송 음원 저장·검증.

업로드한 mp3/wav/mp4 든 TTS 결과물이든 전부 여기를 거쳐 uploads/broadcast/ 에 놓인다.
Agent 는 sha256 으로 캐시가 최신인지 판단하므로 저장할 때 반드시 계산해 둔다.

파일 검증은 확장자만 믿지 않는다 — 앞부분 몇 바이트(매직 넘버)를 같이 본다.
'.mp3' 로 이름만 바꾼 문서를 방송에 걸면 그 시간에 아무 소리도 안 난다.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import subprocess
import uuid
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

# uploads 는 main.py 에서 /uploads 로 서빙된다
BROADCAST_DIR = os.path.join("uploads", "broadcast")
URL_PREFIX = "/uploads/broadcast"

# 확장자 → (mime, 종류)
ALLOWED = {
    ".mp3":  ("audio/mpeg", "AUDIO"),
    ".wav":  ("audio/wav", "AUDIO"),
    ".m4a":  ("audio/mp4", "AUDIO"),
    ".aac":  ("audio/aac", "AUDIO"),
    ".ogg":  ("audio/ogg", "AUDIO"),
    ".mp4":  ("video/mp4", "VIDEO"),
}


class MediaError(ValueError):
    """업로드·검증 실패 — 그대로 사용자에게 보여줄 문장으로 쓴다."""


def ensure_dir() -> str:
    os.makedirs(BROADCAST_DIR, exist_ok=True)
    return BROADCAST_DIR


def _sniff(data: bytes) -> Optional[str]:
    """앞부분을 보고 실제 형식을 추정한다. 모르면 None."""
    if len(data) < 12:
        return None
    if data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "mp3"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "wav"
    if data[4:8] == b"ftyp":                       # mp4 / m4a 공통
        return "mp4"
    if data[:4] == b"OggS":
        return "ogg"
    if data[:4] == b"\xff\xf1" or data[:4] == b"\xff\xf9":
        return "aac"
    return None


def validate(filename: str, data: bytes) -> Tuple[str, str, str]:
    """(정리된 확장자, mime, 종류) 를 돌려주고, 아니면 MediaError.

    확장자와 실제 내용이 다르면 막는다 — 방송 시간에 조용한 사고를 만들지 않으려고.
    """
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED:
        raise MediaError(f"지원하지 않는 형식입니다: {ext or '(확장자 없음)'} "
                         f"— {', '.join(sorted(ALLOWED))} 만 올릴 수 있습니다.")
    if not data:
        raise MediaError("빈 파일입니다.")
    limit = settings.BROADCAST_MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > limit:
        raise MediaError(f"파일이 너무 큽니다. ({len(data) / 1024 / 1024:.1f}MB / 최대 {settings.BROADCAST_MAX_UPLOAD_MB}MB)")

    mime, kind = ALLOWED[ext]
    sniffed = _sniff(data)
    # m4a/aac/mp4 는 컨테이너가 겹쳐 서로 오인될 수 있어 한 묶음으로 본다
    family = {"mp3": {"mp3"}, "wav": {"wav"}, "ogg": {"ogg"},
              "mp4": {"mp4", "m4a", "aac"}, "aac": {"aac", "mp4", "m4a"}}
    if sniffed is None:
        raise MediaError("오디오·영상 파일로 보이지 않습니다. 파일이 손상됐는지 확인해주세요.")
    if ext.lstrip(".") not in family.get(sniffed, {sniffed}):
        raise MediaError(f"확장자({ext})와 실제 파일 형식({sniffed})이 다릅니다. "
                         "이름만 바꾼 파일은 방송할 수 없습니다.")
    return ext, mime, kind


# 방송 음량을 이 수준까지 끌어올린다(dBFS). 0 은 클리핑 직전이라 여유를 둔다.
NORMALIZE_PEAK_DBFS = -1.0
# 아무리 작은 소리라도 이 이상은 키우지 않는다 — 조용한 구간의 잡음까지 커진다
NORMALIZE_MAX_GAIN_DB = 30.0


def normalize_wav(data: bytes) -> bytes:
    """WAV 를 클리핑 직전까지 키운다.

    왜 필요한가: Agent 의 볼륨 조절은 '줄이는' 방향뿐이라(-af volume=0.7),
    원본이 작으면 100% 로 틀어도 작다. 앰프를 올려 보완하면 잡음까지 커진다.
    그래서 만들 때 최대로 키워두고, 현장에서는 앰프로 낮춰 쓰는 편이 낫다.

    ffmpeg 없이 표준 라이브러리만 쓴다(TTS 결과는 WAV 로 받는다).
    16비트 PCM 이 아니면 원본을 그대로 돌려준다 — 못 다루는 것을 망가뜨리지 않는다.

    헤더의 프레임 수는 믿지 않는다. 길이를 모른 채 흘려보내는 WAV(스트리밍)는
    그 자리에 실제와 다른 값이 들어 있고, 그대로 복사해 쓰면 헤더를 쓸 때 넘친다.
    실제로 읽어낸 데이터만 기준으로 삼는다.

    어떤 이유로든 실패하면 원본을 돌려준다 — 음량을 못 키우는 것보다
    방송을 못 만드는 게 나쁘다.
    """
    import array
    import io
    import wave

    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            if w.getsampwidth() != 2:            # 16비트만 다룬다
                return data
            nchannels = w.getnchannels()
            framerate = w.getframerate()
            frames = w.readframes(w.getnframes())   # 남은 만큼만 읽힌다
        if not frames or len(frames) % 2:
            return data

        samples = array.array("h")
        samples.frombytes(frames)
        if not samples:
            return data
        peak = max(abs(min(samples)), abs(max(samples)))
        if peak == 0:
            return data                          # 완전한 무음 — 키울 것이 없다

        target = int(32767 * (10 ** (NORMALIZE_PEAK_DBFS / 20)))
        gain = min(target / peak, 10 ** (NORMALIZE_MAX_GAIN_DB / 20))
        if gain <= 1.01:                         # 이미 충분히 크다
            return data

        for i, v in enumerate(samples):
            x = int(v * gain)
            samples[i] = 32767 if x > 32767 else (-32768 if x < -32768 else x)

        out = io.BytesIO()
        with wave.open(out, "wb") as w:
            # setparams 로 원본 파라미터를 통째로 넘기지 않는다 —
            # 거기 담긴 프레임 수가 실제와 다를 수 있다. 나머지는 wave 가 센다.
            w.setnchannels(nchannels)
            w.setsampwidth(2)
            w.setframerate(framerate)
            w.writeframes(samples.tobytes())
        logger.info("방송 음원 음량 정규화: %.1f배 (peak %d → %d)", gain, peak, int(peak * gain))
        return out.getvalue()
    except Exception as e:                       # 정규화 실패가 방송 생성을 막으면 안 된다
        logger.warning("음량 정규화 건너뜀 (%s: %s)", type(e).__name__, e)
        return data


# 안내방송 앞뒤에 두는 여백(초).
# TTS 는 첫 글자부터 최대 음량으로 시작하고 마지막 글자에서 뚝 끊긴다.
# 앰프·스피커를 거치면 앞은 '툭' 하고 튀고 뒤는 잘려 들린다.
# 사람이 마이크를 잡고 한 박자 쉬었다 말하는 것과 같은 여백을 준다.
TTS_HEAD_SILENCE = 0.7
TTS_TAIL_SILENCE = 0.8


def pad_wav(data: bytes, head: float = TTS_HEAD_SILENCE,
            tail: float = TTS_TAIL_SILENCE) -> bytes:
    """WAV 앞뒤에 무음을 붙인다. 실패하면 원본 그대로 — 여백보다 방송이 우선이다."""
    import array
    import io
    import wave

    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            if w.getsampwidth() != 2:
                return data
            ch, rate = w.getnchannels(), w.getframerate()
            frames = w.readframes(w.getnframes())
        if not frames or not rate:
            return data
        gap_head = b"\x00" * (int(rate * max(head, 0)) * ch * 2)
        gap_tail = b"\x00" * (int(rate * max(tail, 0)) * ch * 2)
        out = io.BytesIO()
        with wave.open(out, "wb") as w:
            w.setnchannels(ch)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(gap_head + frames + gap_tail)
        return out.getvalue()
    except Exception as e:
        logger.warning("여백 추가 건너뜀 (%s: %s)", type(e).__name__, e)
        return data


def prepare_tts(data: bytes, ext: str) -> bytes:
    """TTS 결과를 방송에 쓸 수 있는 형태로 — 음량을 키우고 앞뒤 여백을 준다.

    세 군데(즉시 방송·예약 음성 만들기·프로그램 자동)에서 같은 소리가 나야 하므로
    한 곳에 모아 둔다.
    """
    if ext != "wav":
        return data                              # 다룰 수 있는 것만 손댄다
    return pad_wav(normalize_wav(data))


def wav_duration(data: bytes) -> Optional[int]:
    """WAV 길이(초).

    헤더의 프레임 수 대신 실제로 읽어낸 데이터로 계산한다 —
    스트리밍 WAV 는 헤더 값이 실제와 다르다.
    """
    import io
    import wave
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            rate = w.getframerate()
            width = w.getsampwidth() or 2
            ch = w.getnchannels() or 1
            raw = w.readframes(w.getnframes())
        if not rate:
            return None
        return int(len(raw) / (width * ch) / rate)
    except Exception:
        return None


def has_ffmpeg() -> bool:
    """ffmpeg 을 쓸 수 있는지. 없으면 정규화를 건너뛰되 업로드는 막지 않는다."""
    import shutil
    return bool(shutil.which("ffmpeg"))


def normalize_upload(data: bytes, ext: str) -> Tuple[bytes, str, dict]:
    """업로드 음원을 TTS 와 같은 음량(-1dBFS)으로 맞춘다.

    왜: TTS 는 최대로 키워 저장하는데 업로드 파일은 원본 그대로라, 방송마다
    음량이 들쭉날쭉해진다. 앞 방송에 맞춰 앰프를 올려두면 다음 방송이 크게 나간다.

    두 번 훑는다 — 먼저 최대 진폭을 재고(volumedetect), 그만큼 올린다.
    peak 기준이라 TTS 의 정규화와 같은 잣대다.

    mp4 는 소리만 쓰므로 오디오만 뽑아 저장한다. 영상 트랙은 재생에 쓰지도 않으면서
    디스크와 전송량만 차지한다.

    반환: (처리된 데이터, 최종 확장자, 정보). 실패하면 원본을 그대로 돌려준다 —
    음량을 못 맞추는 것보다 방송이 안 나가는 게 나쁘다.

    원본이 너무 작아 상한(30dB)까지 키워도 모자라면 그 사실을 알린다.
    그냥 두면 "방송이 작게 나온다"는 문제를 나중에 현장에서 겪게 된다.
    """
    import tempfile

    info = {"gain_db": 0.0, "still_quiet": False, "audio_only": False}
    if not has_ffmpeg():
        return data, ext, info
    out_ext = ".mp3" if ext == ".mp4" else ext      # 영상은 소리만 남긴다
    src = dst = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(data); src = f.name
        dst = src + ".out" + out_ext

        # 1차: 최대 진폭 측정
        probe = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostdin", "-i", src,
             "-af", "volumedetect", "-vn", "-f", "null", "-"],
            capture_output=True, text=True, timeout=120)
        gain_db = 0.0
        for line in probe.stderr.splitlines():
            if "max_volume:" in line:
                try:
                    peak_db = float(line.split("max_volume:")[1].strip().split()[0])
                    gain_db = -1.0 - peak_db        # -1dBFS 로 맞춘다
                except (ValueError, IndexError):
                    pass
                break
        needed = gain_db
        gain_db = max(min(gain_db, 30.0), 0.0)      # 키우기만 하고, 과증폭은 제한
        info["gain_db"] = round(gain_db, 1)
        # 상한까지 올려도 목표에 못 미친다 = 원본이 지나치게 작다
        info["still_quiet"] = needed > 30.0

        # 1.5dB 미만은 굳이 다시 인코딩하지 않는다 — 체감 차이는 없고 음질만 잃는다
        if gain_db < 1.5 and out_ext == ext:
            return data, ext, info

        # 2차: 적용 (+ mp4 면 오디오만 추출)
        cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", src, "-vn"]
        if gain_db >= 0.5:
            cmd += ["-af", f"volume={gain_db:.2f}dB"]
        cmd += [dst]
        run = subprocess.run(cmd, capture_output=True, timeout=300)
        if run.returncode != 0 or not os.path.exists(dst) or os.path.getsize(dst) == 0:
            logger.warning("음량 정규화 실패 — 원본을 사용합니다")
            return data, ext, {"gain_db": 0.0, "still_quiet": False, "audio_only": False}
        with open(dst, "rb") as f:
            out = f.read()
        info["audio_only"] = ext == ".mp4"
        logger.info("업로드 음원 정규화: %+.1fdB%s%s", gain_db,
                    " (영상에서 오디오만 추출)" if ext == ".mp4" else "",
                    " — 원본이 너무 작아 최대치까지만" if info["still_quiet"] else "")
        return out, out_ext, info
    except (subprocess.SubprocessError, OSError) as e:
        logger.warning("음량 정규화 건너뜀 (%s)", type(e).__name__)
        return data, ext, {"gain_db": 0.0, "still_quiet": False, "audio_only": False}
    finally:
        for p in (src, dst):
            if p:
                try:
                    os.remove(p)
                except OSError:
                    pass


def probe_duration(path: str) -> Optional[int]:
    """길이(초). ffprobe 가 없으면 None — 없다고 업로드를 막지는 않는다."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=20)
        if out.returncode == 0 and out.stdout.strip():
            return int(float(out.stdout.strip()))
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        pass
    return None


def safe_stem(name: str) -> str:
    """파일명에서 경로·이상한 문자를 걷어낸다(경로 조작 방지)."""
    stem = os.path.splitext(os.path.basename(name or ""))[0]
    stem = re.sub(r"[^0-9A-Za-z가-힣_\- ]+", "", stem).strip()[:60]
    return stem or "broadcast"


def save_bytes(data: bytes, *, ext: str, stem: str = "broadcast") -> dict:
    """파일로 떨어뜨리고 Agent 가 필요로 하는 정보를 돌려준다."""
    ensure_dir()
    fname = f"{safe_stem(stem)}-{uuid.uuid4().hex[:12]}{ext}"
    path = os.path.join(BROADCAST_DIR, fname)
    with open(path, "wb") as f:
        f.write(data)
    return {
        "filename": fname,
        "path": path,
        "url": f"{URL_PREFIX}/{fname}",
        "size_bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "duration_sec": probe_duration(path),
    }


def remove(filename: Optional[str]) -> None:
    """파일 정리 — 없어도 조용히 넘어간다."""
    if not filename:
        return
    try:
        os.remove(os.path.join(BROADCAST_DIR, os.path.basename(filename)))
    except OSError:
        pass


def cleanup_orphans(db, older_than_days: int = 30) -> dict:
    """아무 예약도 쓰지 않는 음원을 지운다.

    예약을 지워도 음원 파일은 남아 디스크에 계속 쌓인다. 50GB 짜리 서버라
    몇 년 두면 부담이 되고, 무엇보다 '왜 있는지 모르는 파일'이 남는 게 좋지 않다.

    갓 만든 파일은 건드리지 않는다 — 관리자가 TTS 를 만들어놓고 아직 예약에
    붙이지 않은 상태일 수 있다(그 사이에 지우면 화면이 깨진다).
    """
    from datetime import timedelta
    from app.models.broadcast import BroadcastMedia, BroadcastSchedule, now_kst

    cutoff = now_kst() - timedelta(days=older_than_days)
    used = {m for (m,) in db.query(BroadcastSchedule.media_id)
            .filter(BroadcastSchedule.media_id.isnot(None)).all()}

    removed, freed = 0, 0
    for m in db.query(BroadcastMedia).all():
        if m.id in used:
            continue
        created = m.created_at
        if created is not None and created.tzinfo is None:
            created = created.replace(tzinfo=cutoff.tzinfo)
        if created is not None and created > cutoff:
            continue                      # 아직 예약에 붙이는 중일 수 있다
        freed += m.size_bytes or 0
        remove(m.filename)
        db.delete(m)
        removed += 1
    if removed:
        db.commit()
        logger.info("방송 음원 정리: %d개 삭제 (%.1fMB)", removed, freed / 1024 / 1024)
    return {"removed": removed, "freed_mb": round(freed / 1024 / 1024, 1)}
