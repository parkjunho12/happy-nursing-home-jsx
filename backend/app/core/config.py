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
    LONG_TOKEN_EXPIRE_DAYS: int = 90   # '로그인 유지' 선택 시 토큰 만료(일)
    
    # CORS
    CORS_ORIGINS: str
    
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Claude (Anthropic) — 제공기록지 AI 검수에서 OpenAI보다 우선 사용
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"
    
    # =============================
    # Email Provider
    # =============================
    EMAIL_PROVIDER: Literal["resend", "sendgrid"] = "resend"

    RESEND_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    # ── 푸시(FCM) ──
    FCM_CREDENTIALS_FILE: str = ""   # Firebase 서비스계정 JSON 경로
    FCM_PROJECT_ID: str = ""

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

    # ── 네이버 검색광고 API ──
    # ⚠️ API/Secret Key는 절대 프론트로 노출하지 않는다. 백엔드에서만 사용.
    NAVER_ADS_BASE_URL: str = "https://api.searchad.naver.com"
    NAVER_ADS_API_KEY: str = ""
    NAVER_ADS_SECRET_KEY: str = ""
    NAVER_ADS_CUSTOMER_ID: str = ""
    # 일일 최대 변경 키워드 수 (0 = 무제한)
    NAVER_ADS_DAILY_MAX_KEYWORD_CHANGES: int = 0
    
    # Upload
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Email (Optional)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    

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