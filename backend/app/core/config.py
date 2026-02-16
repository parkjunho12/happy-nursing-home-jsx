from pydantic_settings import BaseSettings
from typing import List, Literal

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: str
    
    OPENAI_API_KEY: str = ""
    
    # =============================
    # Email Provider
    # =============================
    EMAIL_PROVIDER: Literal["resend", "sendgrid"] = "resend"

    RESEND_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    MAIL_FROM: str = ""
    MAIL_REPLY_TO: str = ""
    MAIL_ADMIN_TO: str = ""  # comma separated

    PUBLIC_SITE_URL: str = ""
    ADMIN_URL: str = ""
    
    SUPPORT_EMAIL: str = ""
    SUPPORT_PHONE: str = ""
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # Environment
    ENVIRONMENT: str = "production"
    
    # Upload
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Email (Optional)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra="ignore"

settings = Settings()