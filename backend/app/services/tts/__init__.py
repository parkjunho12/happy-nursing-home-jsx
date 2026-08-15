"""TTS Provider 추상화.

문구를 오디오 파일로 바꾸는 일만 담당한다. 어떤 업체를 쓰는지는
이 뒤로 숨긴다 — 나중에 원내 서버에서 도는 LocalProvider 로 갈아끼워도
방송 예약·Agent·화면은 그대로다.

    provider = get_provider()          # 설정(BROADCAST_TTS_PROVIDER)에 따라 결정
    result   = provider.synthesize("점심 식사 시간입니다", voice="nova")

반환은 바이트와 확장자다. 파일로 어디에 저장할지는 부르는 쪽이 정한다.
"""
from app.services.tts.base import TTSProvider, TTSResult, TTSError
from app.services.tts.registry import get_provider, available_providers

__all__ = ["TTSProvider", "TTSResult", "TTSError", "get_provider", "available_providers"]
