from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from passlib.context import CryptContext

from app.core.database import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Guardian(Base):
    __tablename__ = "guardians"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resident_id = Column(String, ForeignKey("residents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String, nullable=False)
    relation = Column(String, nullable=False)  # 아들, 딸, 배우자 등
    phone = Column(String, nullable=False, index=True)
    receive_kakao = Column(Boolean, nullable=False, default=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    resident = relationship("Resident", backref="guardians")
    message_logs = relationship("MessageLog", back_populates="guardian")
    
    password_hash = Column(String(255), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    def set_password(self, password: str):
        """비밀번호 해싱"""
        self.password_hash = pwd_context.hash(password)
    
    def verify_password(self, password: str) -> bool:
        """비밀번호 검증"""
        if not self.password_hash:
            return False
        return pwd_context.verify(password, self.password_hash)