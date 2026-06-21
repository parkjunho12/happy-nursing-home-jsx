from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os
from app.core.config import settings
from app.api.v1.router import api_router
import logging
import sys

if settings.ENVIRONMENT == "production":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

else:
    os.makedirs("logs", exist_ok=True)
    log_path = "logs/app.log"
    # 로깅 설정
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_path),
            logging.StreamHandler()
        ]
    )
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Nursing Home Operations Backend")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS Origins: {settings.CORS_ORIGINS_LIST}")
    yield
    # Shutdown
    logger.info("🛑 Shutting down...")

app = FastAPI(
    title="Nursing Home Operations API",
    description="Internal operations management system",
    version="1.0.0",
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# CORS 설정 (중요!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    # 로컬/사설 IP(localhost·127.0.0.1·10.0.2.2·192.168.* 등)는 포트 무관 허용 (개발 편의)
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|10\.0\.2\.2|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Trusted Host (보안)
# CORS_ORIGINS 에 적은 오리진들의 호스트를 자동으로 신뢰 호스트에 포함 (로컬/사설 IP 편의)
from urllib.parse import urlparse as _urlparse
_cors_hosts = []
for _o in settings.CORS_ORIGINS_LIST:
    try:
        _h = _urlparse(_o).hostname
        if _h:
            _cors_hosts.append(_h)
    except Exception:
        pass

_allowed_hosts = list(dict.fromkeys([
    "api.xn--p80bu1t60gba47bg6abm347gsla.com",
    "localhost",
    "127.0.0.1",
    "admin.xn--p80bu1t60gba47bg6abm347gsla.com",  # admin
    "www.xn--p80bu1t60gba47bg6abm347gsla.com",  # web(있으면)
    "backend",          # ✅ 도커 내부에서 Host가 이렇게 잡히는 경우 대비
    "happy_backend",    # ✅ 컨테이너 이름
    "10.0.2.2",         # ✅ 안드로이드 에뮬레이터에서 보는 PC localhost
    "0.0.0.0",
    *_cors_hosts,       # ✅ CORS_ORIGINS 에 적은 호스트(예: 192.168.x.x) 자동 허용
]))

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_allowed_hosts,
)

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")

# 업로드 파일 정적 서빙
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Health Check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }

# Root
@app.get("/")
async def root():
    return {
        "message": "Nursing Home Operations API",
        "docs": "/api/docs" if settings.ENVIRONMENT != "production" else "disabled",
        "version": "1.0.0"
    }
    
    