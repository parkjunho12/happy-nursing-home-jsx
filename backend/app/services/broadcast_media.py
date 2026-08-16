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
