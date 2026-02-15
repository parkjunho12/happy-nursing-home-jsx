from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
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
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Trusted Host (보안)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "api.xn--p80bu1t60gba47bg6abm347gsla.com",
        "localhost",
        "127.0.0.1",
        "admin.xn--p80bu1t60gba47bg6abm347gsla.com",  # admin
        "www.xn--p80bu1t60gba47bg6abm347gsla.com",  # web(있으면)
        "backend",          # ✅ 도커 내부에서 Host가 이렇게 잡히는 경우 대비
        "happy_backend",    # ✅ 컨테이너 이름
    ]
)

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")

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
    