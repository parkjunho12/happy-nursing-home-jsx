"""
KakaoMessageService

현재: Mock implementation
추후: 실제 카카오 알림톡/친구톡 API로 교체

교체 포인트:
1. sendMessage() - 실제 API 호출
2. 환경변수 KAKAO_API_KEY, KAKAO_SENDER_KEY 추가
"""

import asyncio
import random
import os
from typing import List, Dict
from dataclasses import dataclass


@dataclass
class SendMessageResult:
    success: bool
    error: str = None
    message_id: str = None


class KakaoMessageService:
    def __init__(self):
        self.api_key = os.getenv("KAKAO_API_KEY", "mock_api_key")
        self.sender_key = os.getenv("KAKAO_SENDER_KEY", "mock_sender_key")
    
    async def send_message(
        self,
        phone: str,
        message: str,
        photo_urls: List[str]
    ) -> SendMessageResult:
        """
        메시지 발송 (Mock)
        
        실제 API 교체 시:
        - httpx로 카카오 API 호출
        - Authorization 헤더 추가
        
        """
        
        import json
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://kapi.kakao.com/v1/api/talk/friends/message/default/send",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                data={
                    "receiver_uuids": json.dumps([kakao_uuid]),
                    "template_object": json.dumps({
                        "object_type": "feed",
                        "content": {
                            "title": "어르신 소식",
                            "description": message,
                            "image_url": photo_urls[0] if photo_urls else "https://your-domain.com/default.jpg",
                            "link": {
                                "web_url": "https://your-domain.com",
                                "mobile_web_url": "https://your-domain.com",
                            },
                        },
                    }, ensure_ascii=False),
                },
            )
        try:
            # Mock: 전화번호 유효성 검증
            if not self._validate_phone(phone):
                return SendMessageResult(success=False, error="Invalid phone number")
            
            # Mock: API 호출 시뮬레이션 (200ms)
            await asyncio.sleep(0.2)
            
            # Mock: 90% 성공률
            success = random.random() > 0.1
            
            if success:
                message_id = f"msg_{int(asyncio.get_event_loop().time() * 1000)}"
                return SendMessageResult(success=True, message_id=message_id)
            else:
                return SendMessageResult(success=False, error="Mock send failed")
            
            """
            실제 API 사용 예시:
            
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://kapi.kakao.com/v1/api/talk/friends/message/default/send",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "sender_key": self.sender_key,
                        "receiver_uuids": [phone],
                        "template_object": {
                            "object_type": "feed",
                            "content": {
                                "title": "어르신 소식",
                                "description": message,
                                "image_url": photo_urls[0] if photo_urls else "",
                                "link": {"web_url": "https://your-domain.com"}
                            }
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return SendMessageResult(
                        success=True,
                        message_id=result.get("message_id")
                    )
                else:
                    return SendMessageResult(
                        success=False,
                        error=response.text
                    )
            """
            
            
        
        except Exception as e:
            return SendMessageResult(success=False, error=str(e))
    
    def _validate_phone(self, phone: str) -> bool:
        """한국 전화번호 형식 검증"""
        import re
        phone_clean = phone.replace("-", "").replace(" ", "")
        pattern = r"^01[0-9]{8,9}$"
        return bool(re.match(pattern, phone_clean))