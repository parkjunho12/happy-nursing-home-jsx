"""TTS Provider 가 지켜야 하는 약속."""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass


class TTSError(RuntimeError):
    """합성 실패 — 부르는 쪽에서 사용자에게 보여줄 메시지로 쓴다."""


@dataclass
class TTSResult:
    audio: bytes
    ext: str          # 'mp3' | 'wav'
    mime: str
    provider: str
    voice: str


class TTSProvider(ABC):
    """문구 → 오디오."""

    name: str = "base"
    default_voice: str = "default"
    # 이 provider 가 낼 수 있는 목소리 — 화면 선택지로 그대로 쓴다
    voices: tuple[str, ...] = ()

    @abstractmethod
    def synthesize(self, text: str, *, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        ...

    def is_ready(self) -> bool:
        """키가 없거나 준비가 안 되면 False — 화면에서 미리 막기 위해."""
        return True

    def cache_key(self, text: str, *, voice: str | None = None, speed: float = 1.0) -> str:
        """같은 문구·같은 목소리면 다시 만들지 않으려고 쓰는 키."""
        raw = f"{self.name}|{voice or self.default_voice}|{speed:.2f}|{text.strip()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()
