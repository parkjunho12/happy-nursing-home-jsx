"""어떤 Provider 를 쓸지 고르는 곳 — 교체는 환경변수 한 줄로 끝난다."""
from __future__ import annotations

from typing import Dict, List

from app.core.config import settings
from app.services.tts.base import TTSProvider
from app.services.tts.providers import OpenAITTSProvider, LocalTTSProvider, MockTTSProvider

_REGISTRY: Dict[str, type[TTSProvider]] = {
    "openai": OpenAITTSProvider,
    "local": LocalTTSProvider,
    "mock": MockTTSProvider,
}

_cache: Dict[str, TTSProvider] = {}


def get_provider(name: str | None = None) -> TTSProvider:
    key = (name or settings.BROADCAST_TTS_PROVIDER or "openai").lower()
    cls = _REGISTRY.get(key, OpenAITTSProvider)
    if key not in _cache:
        _cache[key] = cls()
    return _cache[key]


def available_providers() -> List[dict]:
    """화면에서 '지금 쓸 수 있는지'까지 보여주기 위해."""
    out = []
    for key, cls in _REGISTRY.items():
        p = get_provider(key)
        out.append({
            "name": key,
            "ready": p.is_ready(),
            "voices": list(p.voices),
            "default_voice": p.default_voice,
            "current": key == (settings.BROADCAST_TTS_PROVIDER or "openai").lower(),
        })
    return out


def register(name: str, cls: type[TTSProvider]) -> None:
    """새 Provider 를 붙일 때 — 코드 수정 없이 확장할 수 있게 열어 둔다."""
    _REGISTRY[name.lower()] = cls
    _cache.pop(name.lower(), None)
