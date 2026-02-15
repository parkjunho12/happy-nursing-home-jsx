from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, verify_password
from app.models.user import User  # UserRole도 필요하면 import

router = APIRouter()


# -------------------------
# Schemas
# -------------------------

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str  # "ADMIN" | "STAFF"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


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

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    로그인 (JSON body)
    - DB에서 email로 유저 조회 후 verify_password
    - token.sub = user.id (DB id)
    - token.role = user.role.value ("ADMIN"/"STAFF")
    """
    user: Optional[User] = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
            name=user.name,
            role=user.role.value,
        ),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout():
    """
    JWT stateless logout: 서버는 할 일 없음.
    클라이언트에서 토큰 삭제하면 됨.
    """
    return LogoutResponse()


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    """
    현재 유저 정보
    - get_current_user는 User ORM을 반환 (security.py 기준)
    """
    return MeResponse(
        user=UserResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            role=current_user.role.value,
        )
    )
