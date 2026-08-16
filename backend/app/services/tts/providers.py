"""실제 TTS 구현들.

- OpenAITTSProvider : 지금 쓰는 것. 프로젝트에 이미 openai 의존성과 키가 있다.
- LocalTTSProvider  : 원내 서버에서 도는 엔진용 자리. 아직 붙이지 않았다 —
                      임의로 지어내지 않고 '준비 안 됨'을 분명히 알린다.
- MockTTSProvider   : 테스트·개발용. 실제 소리가 나는 무음 WAV 를 만든다.
"""
from __future__ import annotations

import io
import logging
import math
import struct
import wave

from app.core.config import settings
from app.services.tts.base import TTSProvider, TTSResult, TTSError

logger = logging.getLogger(__name__)


class OpenAITTSProvider(TTSProvider):
    name = "openai"
    default_voice = "nova"
    voices = ("alloy", "echo", "fable", "onyx", "nova", "shimmer")

    def is_ready(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def synthesize(self, text: str, *, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        text = (text or "").strip()
        if not text:
            raise TTSError("읽을 문구가 비어 있습니다.")
        if not self.is_ready():
            raise TTSError("OPENAI_API_KEY 가 설정되지 않아 음성을 만들 수 없습니다.")
        v = voice if voice in self.voices else self.default_voice
        # 너무 빠르거나 느리면 안내방송으로 못 쓴다
        sp = min(max(float(speed or 1.0), 0.5), 1.5)
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=60)
            resp = client.audio.speech.create(
                model=settings.BROADCAST_TTS_MODEL or "tts-1",
                voice=v, input=text, speed=sp,
                # WAV 로 받는다. 만들고 나서 음량을 최대로 키우려면 PCM 이어야 하고,
                # 서버에는 ffmpeg 이 없어 mp3 를 열 수 없다.
                response_format="wav",
            )
            audio = resp.read() if hasattr(resp, "read") else bytes(resp.content)
        except TTSError:
            raise
        except Exception as e:                       # 업체 장애가 서버를 멈추면 안 된다
            logger.error("TTS 합성 실패 %s: %s", type(e).__name__, e)
            raise TTSError(f"음성 생성에 실패했습니다: {type(e).__name__}") from e
        if not audio:
            raise TTSError("음성 데이터가 비어 있습니다.")
        return TTSResult(audio=audio, ext="wav", mime="audio/wav", provider=self.name, voice=v)


class LocalTTSProvider(TTSProvider):
    """원내 설치형 엔진 자리 — 아직 없다.

    하드웨어·엔진이 정해지지 않은 것을 지어내지 않는다.
    붙일 때 이 클래스만 채우면 나머지는 그대로 돈다.
    """

    name = "local"
    default_voice = "default"

    def is_ready(self) -> bool:
        return False

    def synthesize(self, text: str, *, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        raise TTSError("원내 TTS 엔진이 아직 연결되지 않았습니다. (BROADCAST_TTS_PROVIDER=openai 로 사용하세요)")


class MockTTSProvider(TTSProvider):
    """테스트용 — 외부 호출 없이 문구 길이에 비례하는 WAV 를 만든다.

    무음이 아니라 아주 작은 소리를 넣는다. '파일은 있는데 소리가 없다'는
    상황을 테스트에서 구분하기 위해서다.
    """

    name = "mock"
    default_voice = "test"
    voices = ("test",)

    def synthesize(self, text: str, *, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        text = (text or "").strip()
        if not text:
            raise TTSError("읽을 문구가 비어 있습니다.")
        rate = 16000
        # 한 글자에 0.15초쯤 — 최소 0.5초, 최대 30초
        seconds = min(max(len(text) * 0.15 / max(speed or 1.0, 0.1), 0.5), 30.0)
        frames = int(rate * seconds)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(b"".join(
                struct.pack("<h", int(1200 * math.sin(2 * math.pi * 440 * (i / rate))))
                for i in range(frames)
            ))
        return TTSResult(audio=buf.getvalue(), ext="wav", mime="audio/wav",
                         provider=self.name, voice=voice or self.default_voice)
