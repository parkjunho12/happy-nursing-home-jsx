"""
앨범 API — Cloudflare R2 스토리지 연동
- 관리자: /api/v1/admin/albums
- 보호자: /api/v1/family
"""
import os, uuid
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.album import GuardianAccount, ResidentGuardian, Album, AlbumMedia
from app.models.eval import LtcResident
from app.schemas.response import ApiResponse
from app.services.r2_storage import r2

# ── 상수 ──────────────────────────────────────────────────────────────────────
from app.core.config import settings as _settings
SECRET_KEY   = _settings.SECRET_KEY
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24 * 30   # 30일 (분 단위)

KST     = timezone(timedelta(hours=9))
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer  = HTTPBearer(auto_error=False)


def _normalize_phone(phone: str) -> str:
    """010-1234-1234 / 01012341234 모두 010-1234-1234 형식으로 통일"""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 11 and digits.startswith("0"):
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    return phone  # 형식 불일치면 원본 반환

admin_router  = APIRouter()
family_router = APIRouter()


# ── 보호자 인증 ────────────────────────────────────────────────────────────────
def _guardian_token(guardian_id: str) -> str:
    exp = datetime.now(KST) + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode({"sub": guardian_id, "exp": exp, "type": "guardian"}, SECRET_KEY, ALGORITHM)

def _verify_guardian_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "guardian":
            raise HTTPException(401, "잘못된 토큰 타입")
        return payload["sub"]
    except JWTError:
        raise HTTPException(401, "토큰이 만료되었거나 유효하지 않습니다")

def get_guardian_id(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> str:
    if not creds:
        raise HTTPException(401, "로그인이 필요합니다")
    gid = _verify_guardian_token(creds.credentials)
    g = db.query(GuardianAccount).filter(
        GuardianAccount.id == gid, GuardianAccount.is_active == True
    ).first()
    if not g:
        raise HTTPException(401, "계정을 찾을 수 없습니다")
    return gid


# ── 공통 헬퍼 ─────────────────────────────────────────────────────────────────
def _get_album_or_404(db: Session, album_id: str) -> Album:
    a = db.query(Album).filter(Album.id == album_id).first()
    if not a:
        raise HTTPException(404, "앨범을 찾을 수 없습니다")
    return a

def _check_guardian_access(db: Session, gid: str, resident_id: str):
    link = db.query(ResidentGuardian).filter(
        ResidentGuardian.guardian_id == gid,
        ResidentGuardian.resident_id == resident_id,
    ).first()
    if not link:
        raise HTTPException(403, "접근 권한이 없습니다")

def _album_dict(a: Album, db: Session, include_resident: bool = True) -> dict:
    count = db.query(AlbumMedia).filter(AlbumMedia.album_id == a.id).count()
    res   = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first() if include_resident else None
    return {
        "id": a.id, "title": a.title, "description": a.description,
        "cover_url": a.cover_url, "is_public": a.is_public,
        "media_count": count,
        "resident_name": res.name if res else "",
        "resident_id": a.resident_id,
        "created_at": a.created_at.isoformat(),
    }

def _media_dict(m: AlbumMedia) -> dict:
    return {
        "id": m.id, "media_type": m.media_type,
        "file_url": m.file_url, "thumbnail_url": m.thumbnail_url,
        "file_name": m.file_name, "file_size": m.file_size,
        "created_at": m.created_at.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 관리자 API
# ══════════════════════════════════════════════════════════════════════════════


def _require_can_manage_guardians(current_user: User):
    """ADMIN 또는 사회복지사만 보호자 계정 관리 가능"""
    if current_user.role == 'ADMIN':
        return
    if getattr(current_user, 'position', None) == '사회복지사':
        return
    raise HTTPException(403, "보호자 계정 관리 권한이 없습니다. ADMIN 또는 사회복지사만 접근 가능합니다.")

@admin_router.get("/guardians")
def list_guardians(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_can_manage_guardians(current_user)
    guardians = db.query(GuardianAccount).order_by(GuardianAccount.created_at.desc()).all()
    result = []
    for g in guardians:
        links = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == g.id).all()
        residents = []
        for lk in links:
            res = db.query(LtcResident).filter(LtcResident.id == lk.resident_id).first()
            if res:
                residents.append({"id": res.id, "name": res.name, "relation": lk.relation})
        result.append({
            "id": g.id, "name": g.name, "phone": g.phone,
            "is_active": g.is_active, "created_at": g.created_at.isoformat(),
            "residents": residents,
        })
    return ApiResponse(success=True, data=result)


@admin_router.post("/guardians")
def create_guardian(
    name: str = Form(...),
    phone: str = Form(...),
    password: str = Form(...),
    resident_id: Optional[str] = Form(None),
    relation: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    phone = _normalize_phone(phone)
    if db.query(GuardianAccount).filter(GuardianAccount.phone == phone).first():
        raise HTTPException(400, "이미 등록된 전화번호입니다")
    g = GuardianAccount(
        id=str(uuid.uuid4()), name=name, phone=phone,
        password_hash=pwd_ctx.hash(password),
    )
    db.add(g); db.flush()
    if resident_id:
        db.add(ResidentGuardian(
            id=str(uuid.uuid4()), resident_id=resident_id,
            guardian_id=g.id, relation=relation or "보호자",
        ))
    db.commit()
    return ApiResponse(success=True, data={"id": g.id, "name": g.name, "phone": g.phone})


@admin_router.delete("/guardians/{guardian_id}")
def delete_guardian(guardian_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_can_manage_guardians(current_user)
    g = db.query(GuardianAccount).filter(GuardianAccount.id == guardian_id).first()
    if not g: raise HTTPException(404, "보호자를 찾을 수 없습니다")
    db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == guardian_id).delete()
    db.delete(g); db.commit()
    return ApiResponse(success=True, data=None)



@admin_router.patch("/guardians/{guardian_id}")
def update_guardian(
    guardian_id: str,
    name: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    resident_id: Optional[str] = Form(None),   # 새로 연결할 수급자
    relation: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """보호자 정보 수정 (이름, 전화번호, 비밀번호, 활성상태, 수급자 연결)"""
    g = db.query(GuardianAccount).filter(GuardianAccount.id == guardian_id).first()
    if not g: raise HTTPException(404, "보호자를 찾을 수 없습니다")

    if name is not None:      g.name        = name
    if is_active is not None: g.is_active   = is_active
    if password:              g.password_hash = pwd_ctx.hash(password)
    if phone is not None:
        normalized = _normalize_phone(phone)
        # 중복 체크 (본인 제외)
        dup = db.query(GuardianAccount).filter(
            GuardianAccount.phone == normalized,
            GuardianAccount.id != guardian_id
        ).first()
        if dup: raise HTTPException(400, "이미 사용 중인 전화번호입니다")
        g.phone = normalized

    # 수급자 연결 추가
    if resident_id:
        existing = db.query(ResidentGuardian).filter(
            ResidentGuardian.guardian_id == guardian_id,
            ResidentGuardian.resident_id == resident_id,
        ).first()
        if not existing:
            db.add(ResidentGuardian(
                id=str(uuid.uuid4()),
                resident_id=resident_id,
                guardian_id=guardian_id,
                relation=relation or "보호자",
            ))

    db.commit()
    return ApiResponse(success=True, data={"id": g.id, "name": g.name, "phone": g.phone})


@admin_router.delete("/guardians/{guardian_id}/residents/{resident_id}")
def unlink_guardian_resident(
    guardian_id: str,
    resident_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """보호자-수급자 연결 해제"""
    link = db.query(ResidentGuardian).filter(
        ResidentGuardian.guardian_id == guardian_id,
        ResidentGuardian.resident_id == resident_id,
    ).first()
    if not link: raise HTTPException(404, "연결 정보를 찾을 수 없습니다")
    db.delete(link); db.commit()
    return ApiResponse(success=True, data=None)


@admin_router.get("/albums")
def list_albums(
    resident_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Album)
    if resident_id:
        q = q.filter(Album.resident_id == resident_id)
    albums = q.order_by(Album.created_at.desc()).all()
    return ApiResponse(success=True, data=[_album_dict(a, db) for a in albums])


@admin_router.post("/albums")
def create_album(
    title: str = Form(...),
    resident_ids: str = Form(...),   # JSON 배열 문자열 "[id1, id2]" 또는 단일 ID
    description: Optional[str] = Form(None),
    is_public: bool = Form(True),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    import json as _json
    # resident_ids 파싱 — 단일 ID 또는 JSON 배열 모두 허용
    try:
        ids = _json.loads(resident_ids)
        if isinstance(ids, str):
            ids = [ids]
    except Exception:
        ids = [resident_ids]

    ids = [i for i in ids if i and str(i).strip()]
    if not ids:
        raise HTTPException(400, "수급자를 1명 이상 선택하세요")

    created = []
    for rid in ids:
        a = Album(
            id=str(uuid.uuid4()), title=title,
            resident_id=rid, description=description, is_public=is_public,
        )
        db.add(a)
        created.append({"id": a.id, "title": a.title, "resident_id": rid})

    db.commit()
    return ApiResponse(success=True, data={"created": created, "count": len(created)})


@admin_router.patch("/albums/{album_id}")
def update_album(
    album_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = _get_album_or_404(db, album_id)
    if title is not None:       a.title       = title
    if description is not None: a.description = description
    if is_public is not None:   a.is_public   = is_public
    db.commit()
    return ApiResponse(success=True, data={"id": a.id})


@admin_router.delete("/albums/{album_id}")
def delete_album(album_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = _get_album_or_404(db, album_id)
    # R2에서 미디어 파일 삭제
    media_list = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id).all()
    for m in media_list:
        r2.delete_file(m.file_url, m.thumbnail_url)
    db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id).delete()
    db.delete(a); db.commit()
    return ApiResponse(success=True, data=None)


@admin_router.get("/albums/{album_id}/media")
def list_media(album_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    return ApiResponse(success=True, data=[_media_dict(m) for m in media])


@admin_router.post("/albums/{album_id}/media")
def upload_media(
    album_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = _get_album_or_404(db, album_id)

    # R2 미설정 시 안내
    if not r2.is_configured():
        raise HTTPException(503, "R2 스토리지가 설정되지 않았습니다. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY 환경변수를 확인하세요.")

    saved = []
    for file in files:
        try:
            file_url, thumb_url, media_type, file_size = r2.upload_file(file, album_id)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"파일 업로드 실패: {e}")

        m = AlbumMedia(
            id=str(uuid.uuid4()), album_id=album_id,
            media_type=media_type,
            file_url=file_url,
            thumbnail_url=thumb_url or None,
            file_name=file.filename,
            file_size=file_size,
        )
        db.add(m)

        # 첫 번째 사진을 커버로
        if not a.cover_url and media_type == "photo":
            a.cover_url = thumb_url or file_url

        saved.append({"id": m.id, "url": file_url, "thumb": thumb_url, "type": media_type})

    db.commit()
    return ApiResponse(success=True, data=saved)


@admin_router.delete("/albums/{album_id}/media/{media_id}")
def delete_media(
    album_id: str, media_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    m = db.query(AlbumMedia).filter(
        AlbumMedia.id == media_id, AlbumMedia.album_id == album_id
    ).first()
    if not m: raise HTTPException(404, "미디어를 찾을 수 없습니다")

    # R2에서 삭제
    r2.delete_file(m.file_url, m.thumbnail_url)
    db.delete(m); db.commit()
    return ApiResponse(success=True, data=None)


# ══════════════════════════════════════════════════════════════════════════════
# 보호자 API
# ══════════════════════════════════════════════════════════════════════════════

@family_router.post("/login")
def family_login(
    phone: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    phone = _normalize_phone(phone)
    g = db.query(GuardianAccount).filter(
        GuardianAccount.phone == phone, GuardianAccount.is_active == True
    ).first()
    if not g or not pwd_ctx.verify(password, g.password_hash):
        raise HTTPException(401, "전화번호 또는 비밀번호가 올바르지 않습니다")

    token = _guardian_token(g.id)
    links = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == g.id).all()
    residents = []
    for lk in links:
        res = db.query(LtcResident).filter(LtcResident.id == lk.resident_id).first()
        if res:
            residents.append({"id": res.id, "name": res.name, "relation": lk.relation})

    return ApiResponse(success=True, data={
        "token": token,
        "guardian": {"id": g.id, "name": g.name, "phone": g.phone},
        "residents": residents,
    })


@family_router.get("/me")
def family_me(gid: str = Depends(get_guardian_id), db: Session = Depends(get_db)):
    g = db.query(GuardianAccount).filter(GuardianAccount.id == gid).first()
    links = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == gid).all()
    residents = []
    for lk in links:
        res = db.query(LtcResident).filter(LtcResident.id == lk.resident_id).first()
        if res:
            residents.append({"id": res.id, "name": res.name, "relation": lk.relation})
    return ApiResponse(success=True, data={
        "guardian": {"id": g.id, "name": g.name},
        "residents": residents,
    })


@family_router.get("/albums")
def family_albums(gid: str = Depends(get_guardian_id), db: Session = Depends(get_db)):
    links   = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == gid).all()
    res_ids = [lk.resident_id for lk in links]
    if not res_ids:
        return ApiResponse(success=True, data=[])
    albums = db.query(Album).filter(
        Album.resident_id.in_(res_ids), Album.is_public == True
    ).order_by(Album.created_at.desc()).all()
    return ApiResponse(success=True, data=[_album_dict(a, db) for a in albums])


@family_router.get("/albums/{album_id}")
def family_album_detail(
    album_id: str,
    gid: str = Depends(get_guardian_id),
    db: Session = Depends(get_db),
):
    a = db.query(Album).filter(Album.id == album_id, Album.is_public == True).first()
    if not a: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    _check_guardian_access(db, gid, a.resident_id)

    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    res = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first()

    return ApiResponse(success=True, data={
        "id": a.id, "title": a.title, "description": a.description,
        "cover_url": a.cover_url,
        "resident_name": res.name if res else "",
        "created_at": a.created_at.isoformat(),
        "media": [_media_dict(m) for m in media],
    })


@family_router.get("/download/{media_id}")
def family_download(
    media_id: str,
    token: str,          # query param — <a href="...?token=JWT" download>
    db: Session = Depends(get_db),
):
    """
    보호자 다운로드
    - JWT 인증 후 R2 presigned URL(5분)을 발급해 302 리디렉트
    - 브라우저가 R2에 직접 요청 → iWinv 트래픽 소모 없음
    - Content-Disposition: attachment → 강제 저장
    """
    gid = _verify_guardian_token(token)
    g = db.query(GuardianAccount).filter(
        GuardianAccount.id == gid, GuardianAccount.is_active == True
    ).first()
    if not g: raise HTTPException(401, "인증 실패")

    m = db.query(AlbumMedia).filter(AlbumMedia.id == media_id).first()
    if not m: raise HTTPException(404, "파일을 찾을 수 없습니다")

    album = db.query(Album).filter(Album.id == m.album_id).first()
    if not album: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    _check_guardian_access(db, gid, album.resident_id)

    # R2 presigned URL 발급 → 302 리디렉트
    download_url = r2.presigned_download_url(
        file_url=m.file_url,
        file_name=m.file_name or f"photo_{media_id[:8]}",
        expires_in=300,   # 5분
    )
    return RedirectResponse(url=download_url, status_code=302)


@family_router.get("/albums/{album_id}/download-all")
def family_download_all_info(
    album_id: str,
    gid: str = Depends(get_guardian_id),
    db: Session = Depends(get_db),
):
    """전체 다운로드용 미디어 ID 목록"""
    a = db.query(Album).filter(Album.id == album_id, Album.is_public == True).first()
    if not a: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    _check_guardian_access(db, gid, a.resident_id)

    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    return ApiResponse(success=True, data=[{
        "id": m.id, "file_name": m.file_name, "media_type": m.media_type,
    } for m in media])
