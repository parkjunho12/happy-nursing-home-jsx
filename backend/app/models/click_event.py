"""
Simple Click Event Model - 부정클릭 방지용
"""
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.sql import func
import uuid
import hashlib

from app.core.database import Base


class ClickEvent(Base):
    """클릭 이벤트 모델 (IP 추적)"""
    __tablename__ = "click_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # IP (해시로 저장 - 개인정보 보호)
    ip_hash = Column(String, nullable=False, index=True)
    
    # 클릭 타입 (phone_click, kakao_click)
    event_type = Column(String, nullable=False)
    
    # 의심 플래그
    is_suspicious = Column(Boolean, default=False)
    
    # 시간
    created_at = Column(DateTime, server_default=func.now(), index=True)

    @staticmethod
    def hash_ip(ip: str) -> str:
        """IP를 SHA-256으로 해싱"""
        return hashlib.sha256(ip.encode()).hexdigest()