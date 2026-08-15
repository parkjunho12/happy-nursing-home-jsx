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
    # 서버 부하 알림
    # 기준 사양: 2 vCPU / 4GB RAM / SSD 50GB / 일 20GB 트래픽
    # 순간 튐에는 안 보내고, SUSTAIN_MIN 분 동안 계속 넘을 때만 한 통 보낸다.
    # =============================
    SERVER_ALERT_ENABLED: bool = True
    # 운영 서버에서만 감시한다. 개발용 노트북에서 켜두면 내 PC 상태로 메일이 온다.
    # 로컬에서 일부러 시험해 볼 때만 SERVER_ALERT_FORCE=true 로 켠다.
    SERVER_ALERT_FORCE: bool = False
    SERVER_ALERT_TO: str = "ghdlwnsgh25@gmail.com"   # 쉼표로 여러 명
    SERVER_ALERT_CPU_PCT: float = 85.0        # 2 vCPU — 85% 넘게 눌리면 응답이 밀리기 시작
    SERVER_ALERT_MEM_PCT: float = 85.0        # 4GB 중 85% (약 3.4GB)
    SERVER_ALERT_DISK_PCT: float = 85.0       # 50GB 중 85% (약 42GB) — 사진 업로드가 쌓인다
    # 스왑은 '얼마나 찼나' 만으로는 위험 신호가 아니다(예전에 밀어둔 페이지가 그냥 남아 있다).
    # 메모리까지 같이 높을 때만 경고한다 — 아래 MEM_GATE 와 함께 봐야 의미가 있다.
    SERVER_ALERT_SWAP_PCT: float = 80.0
    SERVER_ALERT_SWAP_MEM_GATE_PCT: float = 75.0   # 메모리가 이만큼 안 차 있으면 스왑은 무시
    SERVER_ALERT_TRAFFIC_GB: float = 16.0     # 일 20GB 중 80%
    SERVER_ALERT_SUSTAIN_MIN: int = 5         # 이 시간(분) 내내 넘어야 발송
    SERVER_ALERT_COOLDOWN_MIN: int = 60       # 같은 항목 재발송 최소 간격(분)
    SERVER_ALERT_INTERVAL_SEC: int = 60       # 점검 주기(초)
    SERVER_ALERT_STATE_FILE: str = "logs/server_alert_state.json"
    

    # =============================
    # Cloudflare R2 Storage
    # =============================
    # 공개 웹(www) 주소 — 공지 카드 이미지·공유 링크의 기준.
    # 로컬 테스트: backend/.env 에 PUBLIC_WEB_URL=http://localhost:3000
    PUBLIC_WEB_URL: str = "https://www.xn--p80bu1t60gba47bg6abm347gsla.com"

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
    # ── R2 빈 값 방어 ──────────────────────────────────────────────
    # docker-compose가 `${R2_ACCOUNT_ID:-}` 로 빈 문자열을 주입하면
    # 환경변수가 .env보다 우선이라 R2가 '미설정'으로 죽는다 (앨범 업로드 503).
    # 빈 값이면 .env 파일 값으로 되살린다 — 운영 사고 재발 방지용.
    def __init__(self, **kw):
        super().__init__(**kw)
        if not self.R2_ACCOUNT_ID or not self.R2_ACCESS_KEY_ID or not self.R2_SECRET_ACCESS_KEY:
            try:
                from dotenv import dotenv_values
                f = dotenv_values(".env")
                for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
                          "R2_BUCKET_NAME", "R2_PUBLIC_URL"):
                    if not getattr(self, k, None) and (f.get(k) or "").strip():
                        object.__setattr__(self, k, f[k].strip())
            except Exception:
                pass

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra="ignore"

settings = Settings()