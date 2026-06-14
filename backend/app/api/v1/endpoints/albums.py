"""
앨범 API
- 관리자: /api/v1/admin/albums
- 보호자: /api/v1/family
"""
import os, uuid, shutil
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.album import GuardianAccount, ResidentGuardian, Album, AlbumMedia
from app.models.eval import LtcResident
from app.schemas.response import ApiResponse

# ── 상수 ──────────────────────────────────────────────────────────────────────
UPLOAD_DIR   = "uploads/albums"
SECRET_KEY   = os.getenv("SECRET_KEY", "nursing-home-album-secret-2026")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24 * 30   # 30일
ALLOWED_EXT  = {'.jpg','.jpeg','.png','.webp','.gif','.mp4','.mov','.avi'}

KST = timezone(timedelta(hours=9))
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

os.makedirs(UPLOAD_DIR, exist_ok=True)

admin_router  = APIRouter()
family_router = APIRouter()


# ── 유틸 ──────────────────────────────────────────────────────────────────────
def _guardian_token(guardian_id: str) -> str:
    exp = datetime.now(KST) + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode({"sub": guardian_id, "exp": exp, "type": "guardian"}, SECRET_KEY, ALGORITHM)

def _verify_guardian_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "guardian":
            raise HTTPException(401, "Invalid token type")
        return payload["sub"]
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

def _get_guardian(token: str = Depends(lambda: None)) -> str:
    """Authorization 헤더 또는 쿼리파라미터 token에서 보호자 ID 추출"""
    from fastapi import Header, Query
    raise HTTPException(401, "Use get_guardian_from_request")

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
bearer = HTTPBearer(auto_error=False)

def get_guardian_id(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db)
) -> str:
    if not creds:
        raise HTTPException(401, "로그인이 필요합니다")
    gid = _verify_guardian_token(creds.credentials)
    g   = db.query(GuardianAccount).filter(
        GuardianAccount.id == gid, GuardianAccount.is_active == True
    ).first()
    if not g:
        raise HTTPException(401, "계정을 찾을 수 없습니다")
    return gid

def _save_file(file: UploadFile, subdir: str) -> tuple[str, str, int]:
    """파일 저장 → (file_url, media_type, file_size)"""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"지원하지 않는 파일 형식: {ext}")
    fid      = str(uuid.uuid4())
    save_dir = os.path.join(UPLOAD_DIR, subdir)
    os.makedirs(save_dir, exist_ok=True)
    path     = os.path.join(save_dir, f"{fid}{ext}")
    size     = 0
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        size = f.tell()
    url        = f"/uploads/albums/{subdir}/{fid}{ext}"
    media_type = "video" if ext in {'.mp4','.mov','.avi'} else "photo"
    return url, media_type, size


# ══════════════════════════════════════════════════════════════════════════════
# 관리자 API
# ══════════════════════════════════════════════════════════════════════════════

@admin_router.get("/guardians")
def list_guardians(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """보호자 계정 목록"""
    guardians = db.query(GuardianAccount).order_by(GuardianAccount.created_at.desc()).all()
    result = []
    for g in guardians:
        links = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == g.id).all()
        resident_names = []
        for lk in links:
            r = db.query(LtcResident).filter(LtcResident.id == lk.resident_id).first()
            if r: resident_names.append({"id": r.id, "name": r.name, "relation": lk.relation})
        result.append({
            "id": g.id, "name": g.name, "phone": g.phone,
            "is_active": g.is_active, "created_at": g.created_at.isoformat(),
            "residents": resident_names,
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
    """보호자 계정 생성"""
    if db.query(GuardianAccount).filter(GuardianAccount.phone == phone).first():
        raise HTTPException(400, "이미 등록된 전화번호입니다")
    g = GuardianAccount(
        id=str(uuid.uuid4()), name=name, phone=phone,
        password_hash=pwd_ctx.hash(password),
    )
    db.add(g)
    db.flush()
    if resident_id:
        db.add(ResidentGuardian(
            id=str(uuid.uuid4()), resident_id=resident_id,
            guardian_id=g.id, relation=relation or "보호자"
        ))
    db.commit()
    return ApiResponse(success=True, data={"id": g.id, "name": g.name, "phone": g.phone})


@admin_router.delete("/guardians/{guardian_id}")
def delete_guardian(guardian_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    g = db.query(GuardianAccount).filter(GuardianAccount.id == guardian_id).first()
    if not g: raise HTTPException(404, "보호자를 찾을 수 없습니다")
    db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == guardian_id).delete()
    db.delete(g); db.commit()
    return ApiResponse(success=True, data=None)


@admin_router.get("/albums")
def list_albums(resident_id: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Album)
    if resident_id: q = q.filter(Album.resident_id == resident_id)
    albums = q.order_by(Album.created_at.desc()).all()
    result = []
    for a in albums:
        count = db.query(AlbumMedia).filter(AlbumMedia.album_id == a.id).count()
        res   = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first()
        result.append({
            "id": a.id, "title": a.title, "description": a.description,
            "cover_url": a.cover_url, "is_public": a.is_public,
            "media_count": count,
            "resident_name": res.name if res else "",
            "resident_id": a.resident_id,
            "created_at": a.created_at.isoformat(),
        })
    return ApiResponse(success=True, data=result)


@admin_router.post("/albums")
def create_album(
    title: str = Form(...),
    resident_id: str = Form(...),
    description: Optional[str] = Form(None),
    is_public: bool = Form(True),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = Album(
        id=str(uuid.uuid4()), title=title,
        resident_id=resident_id, description=description, is_public=is_public,
    )
    db.add(a); db.commit(); db.refresh(a)
    return ApiResponse(success=True, data={"id": a.id, "title": a.title})


@admin_router.patch("/albums/{album_id}")
def update_album(
    album_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = db.query(Album).filter(Album.id == album_id).first()
    if not a: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    if title is not None:       a.title       = title
    if description is not None: a.description = description
    if is_public is not None:   a.is_public   = is_public
    db.commit()
    return ApiResponse(success=True, data={"id": a.id})


@admin_router.delete("/albums/{album_id}")
def delete_album(album_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.query(Album).filter(Album.id == album_id).first()
    if not a: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id).delete()
    db.delete(a); db.commit()
    return ApiResponse(success=True, data=None)


@admin_router.post("/albums/{album_id}/media")
def upload_media(
    album_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = db.query(Album).filter(Album.id == album_id).first()
    if not a: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    saved = []
    for file in files:
        url, mtype, size = _save_file(file, album_id)
        m = AlbumMedia(
            id=str(uuid.uuid4()), album_id=album_id,
            media_type=mtype, file_url=url,
            file_name=file.filename, file_size=size,
        )
        db.add(m)
        if not a.cover_url and mtype == "photo":
            a.cover_url = url
        saved.append({"id": m.id, "url": url, "type": mtype})
    db.commit()
    return ApiResponse(success=True, data=saved)


@admin_router.delete("/albums/{album_id}/media/{media_id}")
def delete_media(album_id: str, media_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    m = db.query(AlbumMedia).filter(AlbumMedia.id == media_id, AlbumMedia.album_id == album_id).first()
    if not m: raise HTTPException(404, "미디어를 찾을 수 없습니다")
    # 파일 삭제 시도
    local = m.file_url.lstrip("/")
    if os.path.exists(local): os.remove(local)
    db.delete(m); db.commit()
    return ApiResponse(success=True, data=None)


@admin_router.get("/albums/{album_id}/media")
def list_media(album_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    return ApiResponse(success=True, data=[{
        "id": m.id, "media_type": m.media_type, "file_url": m.file_url,
        "thumbnail_url": m.thumbnail_url, "file_name": m.file_name,
        "file_size": m.file_size, "created_at": m.created_at.isoformat(),
    } for m in media])


# ══════════════════════════════════════════════════════════════════════════════
# 보호자 API
# ══════════════════════════════════════════════════════════════════════════════

@family_router.post("/login")
def family_login(
    phone: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    g = db.query(GuardianAccount).filter(
        GuardianAccount.phone == phone, GuardianAccount.is_active == True
    ).first()
    if not g or not pwd_ctx.verify(password, g.password_hash):
        raise HTTPException(401, "전화번호 또는 비밀번호가 올바르지 않습니다")
    token = _guardian_token(g.id)
    # 연결된 수급자 목록
    links = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == g.id).all()
    residents = []
    for lk in links:
        r = db.query(LtcResident).filter(LtcResident.id == lk.resident_id).first()
        if r: residents.append({"id": r.id, "name": r.name, "relation": lk.relation})
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
        r = db.query(LtcResident).filter(LtcResident.id == lk.resident_id).first()
        if r: residents.append({"id": r.id, "name": r.name, "relation": lk.relation})
    return ApiResponse(success=True, data={
        "guardian": {"id": g.id, "name": g.name},
        "residents": residents,
    })


@family_router.get("/albums")
def family_albums(gid: str = Depends(get_guardian_id), db: Session = Depends(get_db)):
    """보호자가 볼 수 있는 앨범 목록 (연결된 수급자 앨범만)"""
    links     = db.query(ResidentGuardian).filter(ResidentGuardian.guardian_id == gid).all()
    res_ids   = [lk.resident_id for lk in links]
    if not res_ids:
        return ApiResponse(success=True, data=[])
    albums    = db.query(Album).filter(
        Album.resident_id.in_(res_ids), Album.is_public == True
    ).order_by(Album.created_at.desc()).all()
    result = []
    for a in albums:
        count = db.query(AlbumMedia).filter(AlbumMedia.album_id == a.id).count()
        res   = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first()
        result.append({
            "id": a.id, "title": a.title, "description": a.description,
            "cover_url": a.cover_url, "is_public": a.is_public,
            "media_count": count,
            "resident_name": res.name if res else "",
            "created_at": a.created_at.isoformat(),
        })
    return ApiResponse(success=True, data=result)


@family_router.get("/albums/{album_id}")
def family_album_detail(
    album_id: str,
    gid: str = Depends(get_guardian_id),
    db: Session = Depends(get_db),
):
    """앨범 상세 + 권한 체크"""
    a = db.query(Album).filter(Album.id == album_id, Album.is_public == True).first()
    if not a: raise HTTPException(404, "앨범을 찾을 수 없습니다")
    # 권한: 이 수급자와 연결된 보호자인지 확인
    link = db.query(ResidentGuardian).filter(
        ResidentGuardian.guardian_id == gid,
        ResidentGuardian.resident_id == a.resident_id,
    ).first()
    if not link: raise HTTPException(403, "접근 권한이 없습니다")
    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    res = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first()
    return ApiResponse(success=True, data={
        "id": a.id, "title": a.title, "description": a.description,
        "cover_url": a.cover_url, "resident_name": res.name if res else "",
        "created_at": a.created_at.isoformat(),
        "media": [{
            "id": m.id, "media_type": m.media_type, "file_url": m.file_url,
            "thumbnail_url": m.thumbnail_url, "file_name": m.file_name,
            "created_at": m.created_at.isoformat(),
        } for m in media],
    })
