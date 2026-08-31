import logging
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, verify_password
from app.models.user import User  # UserRole도 필요하면 import
from app.services import login_guard

logger = logging.getLogger(__name__)
router = APIRouter()


def _guard() -> login_guard.LoginGuard:
    """레디스에 붙는다. 못 붙어도 로그인은 막지 않는다 —
    요양원에서 기록을 못 남기는 쪽이 더 큰 사고다."""
    try:
        import redis
        return login_guard.LoginGuard(redis.from_url(settings.REDIS_URL,
                                                     socket_timeout=1,
                                                     socket_connect_timeout=1))
    except Exception as e:
        logger.warning("로그인 잠금용 레디스 연결 실패 (%s)", type(e).__name__)
        return login_guard.LoginGuard(None)


def _client_ip(request: Request) -> str:
    """접속지. Caddy 뒤에 있으므로 X-Forwarded-For 의 맨 앞을 본다.

    맨 앞이 원래 클라이언트다. 뒤쪽은 거쳐 온 프록시라 그걸로 세면
    모든 사람이 한 곳에서 온 것처럼 뭉쳐, 한 사람이 틀린 것 때문에
    다른 사람이 잠긴다."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return (request.client.host if request.client else "?")[:45]


# -------------------------
# Schemas
# -------------------------

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    login_id: Optional[str] = None
    name: str
    role: str  # "ADMIN" | "STAFF"
    position: str | None = None
    allowed_menus: list | None = None


class LoginRequest(BaseModel):
    """아이디(H001) 또는 이메일 중 하나로 들어온다.

    이메일 로그인을 당분간 함께 남긴다 — 전환 중에 아이디를 못 받았거나 잊은
    분이 못 들어오면 그날 근무 기록이 밀린다. 정착되면 email 을 떼어낸다.

    email 이 EmailStr 이 아니라 str 인 이유: 예전 화면이 아이디를 email 칸에
    담아 보내도 422 로 튕기지 않게 하려는 것이다.
    """
    login_id: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(min_length=1)
    remember: bool = False   # True면 장기(기본 90일) 토큰 발급

    @model_validator(mode="after")
    def _need_one(self):
        if not (self.login_id or self.email):
            raise ValueError("아이디 또는 이메일을 입력해주세요")
        return self

    @property
    def ident(self) -> str:
        return (self.login_id or self.email or "").strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MeResponse(BaseModel):
    user: UserResponse


class LogoutResponse(BaseModel):
    success: bool = True
    message: str = "Logged out successfully"


# -------------------------
# Routes
# -------------------------

def _find_user(db: Session, ident: str) -> Optional[User]:
    """아이디로 먼저, 없으면 이메일로 찾는다.

    둘 다 대소문자를 가리지 않는다. 휴대폰 자판은 첫 글자를 제멋대로
    대문자로 만들고, 그것 때문에 못 들어오면 원인을 짐작할 수가 없다.
    """
    v = (ident or "").strip()
    if not v:
        return None
    u = db.query(User).filter(func.upper(User.login_id) == v.upper()).first()
    if u:
        return u
    return db.query(User).filter(func.lower(User.email) == v.lower()).first()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    로그인 (JSON body)
    - 아이디(H001) 또는 이메일로 조회 후 verify_password
    - token.sub = user.id (DB id)
    - token.role = user.role.value ("ADMIN"/"STAFF")

    비밀번호가 네 자리라 시도 제한이 붙어 있다(services/login_guard).
    자릿수가 아니라 그 잠금이 안전을 만든다.
    """
    ident = payload.ident
    ip = _client_ip(request)
    guard = _guard()

    # 잠겨 있으면 비밀번호를 맞게 넣어도 들여보내지 않는다.
    # 여기서 막아야 대입 시도가 실제로 느려진다.
    wait = guard.locked_for(ident, ip)
    if wait > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"로그인 시도가 너무 많습니다. {login_guard.human_wait(wait)} 뒤에 다시 시도해주세요.",
        )

    user: Optional[User] = _find_user(db, ident)

    if not user or not verify_password(payload.password, user.hashed_password):
        guard.record_failure(ident, ip)
        # 아이디가 없는 것인지 비밀번호가 틀린 것인지 구분해 알려주지 않는다 —
        # 구분해 주면 어떤 아이디가 실제로 있는지 훑어낼 수 있다.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    guard.clear(ident, ip)

    if payload.remember:
        access_token_expires = timedelta(days=settings.LONG_TOKEN_EXPIRE_DAYS)
    else:
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,  # Enum -> "ADMIN"/"STAFF"
        },
        expires_delta=access_token_expires,
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            login_id=getattr(user, "login_id", None),
            name=user.name,
            role=user.role.value,
            position=user.position if hasattr(user, "position") else None,
            allowed_menus=getattr(user, "allowed_menus", None) or None,
        ),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout():
    """
    JWT stateless logout: 서버는 할 일 없음.
    클라이언트에서 토큰 삭제하면 됨.
    """
    return LogoutResponse()


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """
    현재 유저 정보 — UserResponse 직접 반환
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        login_id=getattr(current_user, "login_id", None),
        name=current_user.name,
        role=current_user.role.value,
        position=current_user.position if hasattr(current_user, "position") else None,
        allowed_menus=getattr(current_user, "allowed_menus", None) or None,
    )
