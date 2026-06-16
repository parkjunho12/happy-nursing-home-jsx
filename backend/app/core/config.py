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
    


    # =============================
    # AI Provider (검수 기능)
    # =============================
    AI_PROVIDER: str = "claude"          # claude | openai
    CLAUDE_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-3-5-sonnet-latest"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # =============================
    # Cloudflare R2 Storage
    # =============================
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "happy-nursing-home-albums"
    R2_PUBLIC_URL: str = ""        # https://pub-xxxx.r2.dev 또는 커스텀 도메인
    R2_PRESIGN_EXPIRE: int = 300   # presigned URL 만료 시간 (초, 기본 5분)

    @property
    def R2_ENDPOINT_URL(self) -> str:
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    @property
    def R2_CONFIGURED(self) -> bool:
        return bool(self.R2_ACCOUNT_ID and self.R2_ACCESS_KEY_ID and self.R2_SECRET_ACCESS_KEY)
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra="ignore"

settings = Settings()