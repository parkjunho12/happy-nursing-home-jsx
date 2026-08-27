from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import asyncio
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


async def _dayparting_scheduler_loop():
    """매시 정각마다 시간대 자동 입찰 조정을 1회 실행한다(상시 가동 서버용)."""
    from app.core.database import SessionLocal
    from app.services.naver_ads_scheduler import run_hourly
    import datetime as _dt
    while True:
        try:
            now = _dt.datetime.now()
            # 다음 정각까지 대기
            secs = 3600 - (now.minute * 60 + now.second)
            await asyncio.sleep(max(30, secs))
            db = SessionLocal()
            try:
                # 동기 작업(DB+네이버 API)은 스레드풀에서 실행
                await asyncio.to_thread(run_hourly, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:  # 루프는 절대 죽지 않도록
            logger.warning("dayparting scheduler tick error: %s", type(e).__name__)
            await asyncio.sleep(60)


async def _bid_override_loop():
    """임시 입찰 오버라이드를 1분마다 점검(짧은 창도 놓치지 않도록)."""
    from app.core.database import SessionLocal
    from app.services.naver_ads_scheduler import apply_bid_overrides
    while True:
        try:
            await asyncio.sleep(60)
            db = SessionLocal()
            try:
                await asyncio.to_thread(apply_bid_overrides, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("bid override tick error: %s", type(e).__name__)
            await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Nursing Home Operations Backend")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS Origins: {settings.CORS_ORIGINS_LIST}")

    # 시간대 자동 입찰 스케줄러 시작
    _scheduler_task = asyncio.create_task(_dayparting_scheduler_loop())
    _override_task = asyncio.create_task(_bid_override_loop())
    # 월별 앨범 자동 생성 루프는 제거 — 수급자 등록 시 + 「이번 달 앨범 만들기」 버튼으로만 생성
    logger.info("⏰ Dayparting bid scheduler + override loop started")

    # 서버 부하 감시 (CPU·메모리·디스크·트래픽) — 임계치 초과 시 메일
    from app.services.server_monitor import monitor_loop as _monitor_loop
    _health_task = asyncio.create_task(_monitor_loop())

    yield
    # Shutdown
    _scheduler_task.cancel()
    _override_task.cancel()
    _health_task.cancel()
    for _t in (_scheduler_task, _override_task, _health_task):
        try:
            await _t
        except Exception:
            pass
    logger.info("🛑 Shutting down...")

app = FastAPI(
    title="Nursing Home Operations API",
    description="Internal operations management system",
    version="1.0.0",
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# AI 페이지 편집기의 미리보기(preview.도메인)도 같은 API 를 본다.
#
# 미리보기는 admin 과 다른 출처라, 허용해 두지 않으면 브라우저가 모든 호출을
# 막는다. 토큰을 넘겨줘도 화면에는 아무것도 안 나온다.
#
# 아무 preview.* 나 열어주지는 않는다. 이미 믿고 있는 출처(admin.·www.)의
# 형제만 만들어 붙인다 — CORS_ORIGINS 를 손으로 고치고 다시 세우게 하면
# 빠뜨리기 쉽고, 반대로 preview.아무데나 를 열면 그건 구멍이다.
import re as _re
from urllib.parse import urlparse as _up

_preview_origins: list[str] = []
for _o in settings.CORS_ORIGINS_LIST:
    _h = (_up(_o).hostname or "")
    _head, _, _rest = _h.partition(".")
    if _rest and _head in ("admin", "www"):
        _preview_origins.append(f"https://preview.{_rest}")
_preview_origins = list(dict.fromkeys(_preview_origins))

_LOCAL_RE = (r"^http://(localhost|127\.0\.0\.1|10\.0\.2\.2|10\.\d+\.\d+\.\d+"
             r"|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$")
_ORIGIN_RE = _LOCAL_RE
if _preview_origins:
    _ORIGIN_RE = "(?:%s)|(?:^(?:%s)$)" % (
        _LOCAL_RE, "|".join(_re.escape(o) for o in _preview_origins))
    logger.info(f"미리보기 출처 허용: {_preview_origins}")

# CORS 설정 (중요!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    # 로컬/사설 IP(localhost·127.0.0.1·10.0.2.2·192.168.* 등)는 포트 무관 허용 (개발 편의)
    # + AI 편집기 미리보기 출처(위에서 만든 것)
    allow_origin_regex=_ORIGIN_RE,
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
    
    