"""
앨범 API — Cloudflare R2 스토리지 연동
- 관리자: /api/v1/admin/albums
- 보호자: /api/v1/family
"""
import os, uuid, logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.album import GuardianAccount, ResidentGuardian, Album, AlbumMedia
from app.models.push import FamilyPushToken
from app.models.album_view import FamilyAlbumView
from app.services.fcm import send_to_tokens, is_available
from pydantic import BaseModel
from app.models.eval import LtcResident
from app.schemas.response import ApiResponse
from app.services.r2_storage import r2

# ── 상수 ──────────────────────────────────────────────────────────────────────
from app.core.config import settings as _settings

logger = logging.getLogger(__name__)
SECRET_KEY   = _settings.SECRET_KEY
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24 * 30   # 30일 (분 단위)

KST     = timezone(timedelta(hours=9))
NOTIFY_DEBOUNCE_SEC = 180  # 승인 자동 푸시 디바운스(여러 장 승인 시 1회)
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
    count = db.query(AlbumMedia).filter(AlbumMedia.album_id == a.id, AlbumMedia.status == "approved").count()
    pending = db.query(AlbumMedia).filter(AlbumMedia.album_id == a.id, AlbumMedia.status == "pending").count()
    res   = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first() if include_resident else None
    return {
        "id": a.id, "title": a.title, "description": a.description,
        "cover_url": a.cover_url, "is_public": a.is_public,
        "media_count": count, "pending_count": pending,
        "resident_name": res.name if res else "",
        "resident_id": a.resident_id,
        "created_at": a.created_at.isoformat(),
    }

def _media_dict(m: AlbumMedia, uploader_names: dict | None = None) -> dict:
    uid = getattr(m, "uploaded_by", None)
    return {
        "id": m.id, "media_type": m.media_type,
        "file_url": m.file_url, "thumbnail_url": m.thumbnail_url,
        "file_name": m.file_name, "file_size": m.file_size,
        "status": getattr(m, "status", "approved"),
        "uploaded_by": uid,
        "uploaded_by_name": (uploader_names or {}).get(uid),
        "created_at": m.created_at.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 관리자 API
# ══════════════════════════════════════════════════════════════════════════════


def _can_approve(current_user: User) -> bool:
    """앨범 사진 승인 권한: ADMIN · 대표 · 이사 · 시설장"""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    return role == "ADMIN" or pos in ("대표", "이사", "시설장")


def _is_admin(current_user: User) -> bool:
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    return role == "ADMIN"


def _uploader_names(db: Session, media_list) -> dict:
    ids = {getattr(m, "uploaded_by", None) for m in media_list if getattr(m, "uploaded_by", None)}
    if not ids:
        return {}
    rows = db.query(User.id, User.name).filter(User.id.in_(ids)).all()
    return {r[0]: r[1] for r in rows}


def _require_can_manage_guardians(current_user: User):
    """보호자 계정 관리 — ADMIN · 사회복지사 · 시설장"""
    if current_user.role == 'ADMIN':
        return
    if getattr(current_user, 'position', None) in ('사회복지사', '시설장'):
        return
    raise HTTPException(403, "보호자 계정 관리 권한이 없습니다. (ADMIN·사회복지사·시설장)")

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
def list_media(album_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    uploader_names = _uploader_names(db, media) if _is_admin(current_user) else {}
    return ApiResponse(success=True, data=[_media_dict(m, uploader_names) for m in media])


@admin_router.post("/albums/generate-monthly")
def generate_monthly(month: Optional[str] = None, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """월별 앨범 일괄 생성 — 재원 어르신 전원, 퇴소자 제외, 멱등.

    매월 1일 자동으로도 돌지만, 버튼으로 즉시 만들 수도 있다."""
    _require_can_manage_guardians(current_user)   # ADMIN·사회복지사
    from datetime import datetime
    from app.services.monthly_albums import ensure_monthly_albums
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
        except Exception:
            raise HTTPException(400, "month는 YYYY-MM 형식이어야 합니다.")
    else:
        now = datetime.now(KST)
        y, m = now.year, now.month
    return ApiResponse(success=True, data=ensure_monthly_albums(db, y, m))


@admin_router.get("/albums/storage-status")
def storage_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """R2 스토리지 진단 — 운영에서 '사진이 안 올라간다' 할 때 원인을 바로 본다.

    설정 여부 + 실제 쓰기·삭제 왕복 테스트까지. ADMIN 전용."""
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role != "ADMIN":
        raise HTTPException(403, "관리자만 볼 수 있습니다.")
    from app.core.config import settings as _st
    out = {
        "r2_configured": r2.is_configured(),
        "bucket": getattr(_st, "R2_BUCKET_NAME", None),
        "public_url_set": bool(getattr(_st, "R2_PUBLIC_URL", None)),
        "roundtrip": None, "error": None,
    }
    if out["r2_configured"]:
        try:
            from app.services.r2_storage import _get_client, _bucket
            key = "diagnostics/storage-status-probe.txt"
            _get_client().put_object(Bucket=_bucket(), Key=key, Body=b"ok", ContentType="text/plain")
            _get_client().delete_object(Bucket=_bucket(), Key=key)
            out["roundtrip"] = "ok"
        except Exception as e:
            out["roundtrip"] = "fail"
            out["error"] = str(e)[:300]
    return ApiResponse(success=True, data=out)


@admin_router.post("/albums/{album_id}/media")
def upload_media(
    album_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = _get_album_or_404(db, album_id)
    # 자동 공개 대상: ADMIN · 대표 · 이사 · 시설장. 그 외 직책은 관리자 승인 전까지 비공개(pending)
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    pos = getattr(current_user, "position", None)
    pos = pos.value if hasattr(pos, "value") else str(pos or "")
    auto_approve = (role == "ADMIN") or (pos in ("대표", "이사", "시설장"))
    media_status = "approved" if auto_approve else "pending"

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
            status=media_status,
            uploaded_by=current_user.id,
        )
        db.add(m)

        # 첫 번째 '승인된' 사진만 커버로
        if not a.cover_url and media_type == "photo" and media_status == "approved":
            a.cover_url = thumb_url or file_url

        saved.append({"id": m.id, "url": file_url, "thumb": thumb_url, "type": media_type, "status": media_status})

    db.commit()

    # 관리자(자동 승인) 업로드도 보호자에게 알린다.
    # 예전에는 '승인' 단계에서만 자동 푸시라, 관리자가 직접 올리면 승인 절차가 없어
    # 푸시가 한 번도 안 나갔다 — "사진 추가됐는데 알림이 안 와요"의 원인.
    # 승인 경로와 같은 3분 디바운스를 써서 여러 장 연속 업로드에도 1회만 발송한다.
    if auto_approve and saved:
        try:
            now = datetime.now(KST)
            ln = a.last_notified_at
            if ln is not None and ln.tzinfo is None:
                ln = ln.replace(tzinfo=KST)
            if ln is None or (now - ln).total_seconds() > NOTIFY_DEBOUNCE_SEC:
                _notify_album_guardians(db, a)
                a.last_notified_at = now
                db.commit()
        except Exception as e:
            logger.warning(f"업로드 자동 푸시 실패(업로드는 성공): {e}")
            db.rollback()

    return ApiResponse(success=True, data=saved)


class MediaStatusBody(BaseModel):
    status: str  # approved | pending | rejected


@admin_router.patch("/albums/{album_id}/media/{media_id}/status")
def set_media_status(album_id: str, media_id: str, body: MediaStatusBody,
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _can_approve(current_user):
        raise HTTPException(403, "승인 권한이 없습니다. (관리자 또는 사회복지사)")
    if body.status not in ("approved", "pending", "rejected"):
        raise HTTPException(400, "잘못된 상태값입니다.")
    m = db.query(AlbumMedia).filter(AlbumMedia.id == media_id, AlbumMedia.album_id == album_id).first()
    if not m:
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    m.status = body.status
    if body.status == "approved":
        m.approved_by = current_user.id
        m.approved_at = datetime.now(KST)
        # 커버 미설정이면 이 사진으로
        a = db.query(Album).filter(Album.id == album_id).first()
        if a and not a.cover_url and m.media_type == "photo":
            a.cover_url = m.thumbnail_url or m.file_url
    db.commit()

    # 승인 시 보호자에게 자동 푸시 — 3분 디바운스(여러 장 연속 승인해도 1회만 발송)
    if body.status == "approved":
        try:
            a = db.query(Album).filter(Album.id == album_id).first()
            now = datetime.now(KST)
            ln = a.last_notified_at if a else None
            if ln is not None and ln.tzinfo is None:
                ln = ln.replace(tzinfo=KST)
            if a and (ln is None or (now - ln).total_seconds() > NOTIFY_DEBOUNCE_SEC):
                _notify_album_guardians(db, a)
                a.last_notified_at = now
                db.commit()
        except Exception as e:
            logger.warning(f"승인 자동 푸시 실패: {e}")
            db.rollback()

    return ApiResponse(success=True, data=_media_dict(m))


@admin_router.get("/pending-media")
def list_pending_media(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """승인 대기 사진 목록(앨범/어르신 정보 포함)."""
    rows = db.query(AlbumMedia).filter(AlbumMedia.status == "pending")\
             .order_by(AlbumMedia.created_at.desc()).limit(500).all()
    unames = _uploader_names(db, rows) if _is_admin(current_user) else {}
    out = []
    for m in rows:
        a = db.query(Album).filter(Album.id == m.album_id).first()
        res = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first() if a else None
        d = _media_dict(m, unames)
        d.update({
            "album_id": m.album_id,
            "album_title": a.title if a else None,
            "resident_name": res.name if res else None,
        })
        out.append(d)
    return ApiResponse(success=True, data=out)


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

    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id, AlbumMedia.status == "approved")\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    res = db.query(LtcResident).filter(LtcResident.id == a.resident_id).first()

    _log_view(db, gid, album_id, None, "open")

    return ApiResponse(success=True, data={
        "id": a.id, "title": a.title, "description": a.description,
        "cover_url": a.cover_url,
        "resident_name": res.name if res else "",
        "created_at": a.created_at.isoformat(),
        "media": [_media_dict(m) for m in media],
    })


class ViewBody(BaseModel):
    media_id: Optional[str] = None
    event_type: Optional[str] = "photo"


@family_router.post("/albums/{album_id}/view")
def family_track_view(
    album_id: str,
    body: ViewBody,
    gid: str = Depends(get_guardian_id),
    db: Session = Depends(get_db),
):
    """보호자앱 열람 추적(사진 조회 등). fire-and-forget."""
    et = body.event_type if body.event_type in ("open", "photo") else "photo"
    _log_view(db, gid, album_id, body.media_id, et)
    return ApiResponse(success=True, data={"ok": True})


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

    _log_view(db, gid, m.album_id, m.id, "download")

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


@family_router.get("/albums/{album_id}/download-zip")
def family_download_zip(
    album_id: str,
    token: str,           # query param — <a href="...?token=JWT"> 로 단일 다운로드
    db: Session = Depends(get_db),
):
    """앨범 전체 사진/영상을 ZIP 한 파일로 묶어 내려준다. (전체 저장)"""
    import io, zipfile, re
    from urllib.parse import quote

    gid = _verify_guardian_token(token)
    g = db.query(GuardianAccount).filter(
        GuardianAccount.id == gid, GuardianAccount.is_active == True
    ).first()
    if not g:
        raise HTTPException(401, "인증 실패")

    a = db.query(Album).filter(Album.id == album_id, Album.is_public == True).first()
    if not a:
        raise HTTPException(404, "앨범을 찾을 수 없습니다")
    _check_guardian_access(db, gid, a.resident_id)

    if not r2.is_configured():
        raise HTTPException(503, "스토리지가 설정되지 않았습니다")

    media = db.query(AlbumMedia).filter(AlbumMedia.album_id == album_id)\
              .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all()
    if not media:
        raise HTTPException(404, "사진이 없습니다")

    buf = io.BytesIO()
    added = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, m in enumerate(media, 1):
            data = r2.fetch_bytes(m.file_url)
            if not data:
                continue
            name = m.file_name or ""
            if "." not in name:
                ext = m.file_url.rsplit(".", 1)[-1] if "." in m.file_url else ("mp4" if m.media_type == "video" else "jpg")
                name = (name or "media") + "." + ext
            zf.writestr(f"{idx:02d}_{name}", data)
            added += 1

    if added == 0:
        raise HTTPException(502, "다운로드할 파일을 가져오지 못했습니다")

    buf.seek(0)
    title = re.sub(r"[^\w가-힣 ._-]", "", a.title or "album").strip() or "album"
    disposition = "attachment; filename=\"album.zip\"; filename*=UTF-8''" + quote(title) + ".zip"
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": disposition},
    )



# ══════════════════════════════════════════════════════════════════════════════
# 푸시 알림 (FCM)
# ══════════════════════════════════════════════════════════════════════════════

class PushRegisterBody(BaseModel):
    token: str
    platform: Optional[str] = "android"


@family_router.post("/push/register")
def register_push_token(
    body: PushRegisterBody,
    db: Session = Depends(get_db),
    gid: str = Depends(get_guardian_id),
):
    """보호자 앱이 FCM 토큰을 등록 (로그인된 보호자 계정에 연결)."""
    token = (body.token or "").strip()
    if not token:
        raise HTTPException(400, "token이 필요합니다")
    existing = db.query(FamilyPushToken).filter(FamilyPushToken.token == token).first()
    if existing:
        existing.guardian_id = gid
        existing.platform = body.platform or "android"
    else:
        db.add(FamilyPushToken(
            id=str(uuid.uuid4()), guardian_id=gid,
            token=token, platform=body.platform or "android",
        ))
    db.commit()
    return ApiResponse(success=True, data={"registered": True})


@family_router.post("/push/unregister")
def unregister_push_token(
    body: PushRegisterBody,
    db: Session = Depends(get_db),
    gid: str = Depends(get_guardian_id),
):
    token = (body.token or "").strip()
    if token:
        db.query(FamilyPushToken).filter(
            FamilyPushToken.token == token,
            FamilyPushToken.guardian_id == gid,
        ).delete(synchronize_session=False)
        db.commit()
    return ApiResponse(success=True, data={"unregistered": True})


def _log_view(db: Session, guardian_id: str, album_id: str, media_id, event_type: str):
    """보호자 열람 이벤트 기록 (실패해도 요청에 영향 없음)."""
    try:
        db.add(FamilyAlbumView(
            guardian_id=guardian_id, album_id=album_id,
            media_id=media_id, event_type=event_type,
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"열람 로그 기록 실패: {e}")
        db.rollback()


def _notify_album_guardians(db: Session, album: Album) -> dict:
    """앨범 수급자의 보호자들에게 '새 사진' 푸시 발송. (무효 토큰은 정리)"""
    links = db.query(ResidentGuardian).filter(
        ResidentGuardian.resident_id == album.resident_id
    ).all()
    guardian_ids = [l.guardian_id for l in links]
    if not guardian_ids:
        return {"guardians": 0, "tokens": 0, "sent": 0, "failed": 0}

    # 보낼 미디어 수 (안내문에 사용)
    media_count = db.query(AlbumMedia).filter(AlbumMedia.album_id == album.id).count()
    title = "📸 새 사진이 도착했어요"
    if media_count > 0:
        body = f"‘{album.title}’ 앨범에 사진 {media_count}장이 준비됐어요 💛 지금 우리 가족 일상을 확인해보세요"
    else:
        body = f"‘{album.title}’ 앨범을 확인해보세요 💛"
    cover = album.cover_url if (album.cover_url and album.cover_url.startswith("http")) else None

    try:
        token_rows = db.query(FamilyPushToken).filter(
            FamilyPushToken.guardian_id.in_(guardian_ids)
        ).all()
        tokens = [t.token for t in token_rows]

        sent, failed, invalid = send_to_tokens(
            tokens, title, body,
            data={"type": "album", "album_id": album.id, "album_title": album.title},
            image=cover,
        )
        if invalid:
            db.query(FamilyPushToken).filter(
                FamilyPushToken.token.in_(invalid)
            ).delete(synchronize_session=False)
            db.commit()
    except Exception as e:
        # family_push_tokens 테이블 미생성(마이그레이션 누락) 등 → 푸시만 건너뜀
        logger.warning(f"푸시 토큰 조회/발송 생략: {e}")
        db.rollback()
        return {"guardians": len(guardian_ids), "tokens": 0, "sent": 0, "failed": 0,
                "push_skipped": True}
    return {"guardians": len(guardian_ids), "tokens": len(tokens), "sent": sent, "failed": failed}


@admin_router.post("/albums/{album_id}/notify")
def notify_album(
    album_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """해당 앨범 수급자의 보호자들에게 '새 앨범 도착' 푸시 발송 (관리자 수동)."""
    _require_can_manage_guardians(current_user)
    album = _get_album_or_404(db, album_id)
    result = _notify_album_guardians(db, album)
    if result["guardians"] == 0:
        result["message"] = "연결된 보호자가 없습니다"
    return ApiResponse(success=True, data=result)


@admin_router.get("/albums-fcm-status")
def fcm_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """FCM 설정 상태 + 등록 토큰 현황."""
    _require_can_manage_guardians(current_user)
    total = db.query(FamilyPushToken).count()
    guardians = db.query(FamilyPushToken.guardian_id).distinct().count()
    return ApiResponse(success=True, data={
        "configured": is_available(),
        "project_id": _settings.FCM_PROJECT_ID or None,
        "tokens": total,
        "guardians_with_token": guardians,
    })


@admin_router.get("/albums-engagement")
def album_engagement(days: int = 30, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """보호자 앨범 열람 참여도 집계(앨범별)."""
    _require_can_manage_guardians(current_user)
    since = datetime.now(KST) - timedelta(days=max(1, min(days, 365)))
    rows = db.query(FamilyAlbumView).filter(FamilyAlbumView.created_at >= since).all()

    agg = {}
    for v in rows:
        d = agg.setdefault(v.album_id, {"opens": 0, "photos": 0, "downloads": 0, "guardians": set(), "last": None})
        if v.event_type == "open": d["opens"] += 1
        elif v.event_type == "photo": d["photos"] += 1
        elif v.event_type == "download": d["downloads"] += 1
        d["guardians"].add(v.guardian_id)
        if v.created_at and (d["last"] is None or v.created_at > d["last"]):
            d["last"] = v.created_at

    out = []
    for aid, d in agg.items():
        alb = db.query(Album).filter(Album.id == aid).first()
        res = db.query(LtcResident).filter(LtcResident.id == alb.resident_id).first() if alb else None
        last = d["last"]
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=KST)
        out.append({
            "album_id": aid,
            "album_title": alb.title if alb else "(삭제된 앨범)",
            "resident_id": alb.resident_id if alb else None,
            "resident_name": res.name if res else None,
            "opens": d["opens"], "photo_views": d["photos"], "downloads": d["downloads"],
            "unique_guardians": len(d["guardians"]),
            "last_viewed_at": last.astimezone(KST).isoformat() if last else None,
        })
    out.sort(key=lambda x: (x["opens"] + x["photo_views"]), reverse=True)

    summary = {
        "days": days,
        "total_opens": sum(o["opens"] for o in out),
        "total_photo_views": sum(o["photo_views"] for o in out),
        "total_downloads": sum(o["downloads"] for o in out),
        "active_albums": len(out),
        "active_guardians": len({v.guardian_id for v in rows}),
    }
    return ApiResponse(success=True, data={"summary": summary, "albums": out})


# ── 월별 사진 전체 다운로드 (ZIP) ─────────────────────────────────────────────
@admin_router.get("/albums/download-month")
def download_month_zip(
    month: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """해당 월 앨범의 승인된 사진 전부를 ZIP 하나로.

    - 월 판정: 제목 "YYYY년 M월…" 우선, 없으면 생성월 (프론트 monthKeyOf와 동일)
    - ZIP 안 구조: 어르신이름/앨범제목/파일명 — 폴더째 정리돼 받는 즉시 쓸 수 있게
    - 사진은 이미 압축된 JPEG이므로 무압축(STORED)으로 묶는다 — CPU 낭비 없이 빠르게
    """
    import io as _io
    import os as _os
    import re as _re
    import tempfile
    import zipfile
    from fastapi.responses import StreamingResponse
    from urllib.parse import quote as _q

    if not _re.match(r"^\d{4}-\d{2}$", month or ""):
        raise HTTPException(400, "month 형식은 YYYY-MM 이어야 합니다.")

    def month_key(a: Album) -> str:
        m = _re.match(r"^(\d{4})년 (\d{1,2})월", a.title or "")
        if m:
            return f"{m.group(1)}-{int(m.group(2)):02d}"
        return a.created_at.strftime("%Y-%m") if a.created_at else ""

    albums = [a for a in db.query(Album).all() if month_key(a) == month]
    if not albums:
        raise HTTPException(404, "해당 월의 앨범이 없습니다.")
    res_names = {r.id: r.name for r in db.query(LtcResident).all()}

    # R2 키 직접 조회 준비 (공개 URL을 다시 인터넷으로 받지 않도록)
    r2 = None
    r2_prefix = None
    try:
        from app.core.config import settings as _st
        if _st.R2_PUBLIC_URL:
            from app.services.r2_storage import _get_client, _bucket
            r2 = (_get_client(), _bucket())
            r2_prefix = _st.R2_PUBLIC_URL.rstrip("/") + "/"
    except Exception:
        r2 = None

    def fetch(url: str):
        try:
            if url.startswith("/uploads/"):
                path = url.lstrip("/")
                if _os.path.exists(path):
                    with open(path, "rb") as f:
                        return f.read()
                return None
            if r2 and r2_prefix and url.startswith(r2_prefix):
                key = url[len(r2_prefix):]
                obj = r2[0].get_object(Bucket=r2[1], Key=key)
                return obj["Body"].read()
            import httpx
            resp = httpx.get(url, timeout=30)
            return resp.content if resp.status_code == 200 else None
        except Exception:
            return None

    safe = lambda t: _re.sub(r'[\\/:*?"<>|]', "_", t or "").strip() or "무제"  # noqa: E731
    tmp = tempfile.SpooledTemporaryFile(max_size=64 * 1024 * 1024)
    count, skipped = 0, 0
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as zf:
        for a in albums:
            media = (db.query(AlbumMedia)
                       .filter(AlbumMedia.album_id == a.id,
                               AlbumMedia.media_type == "photo",
                               AlbumMedia.status == "approved")
                       .order_by(AlbumMedia.sort_order, AlbumMedia.created_at).all())
            if not media:
                continue
            folder = f"{safe(res_names.get(a.resident_id, '이름미상'))}/{safe(a.title)}"
            used = set()
            for i, m in enumerate(media, 1):
                data = fetch(m.file_url)
                if not data:
                    skipped += 1
                    continue
                ext = _os.path.splitext(m.file_name or m.file_url)[1].lower() or ".jpg"
                base = _os.path.splitext(safe(m.file_name or ""))[0] or f"{i:03d}"
                name = f"{base}{ext}"
                j = 1
                while name in used:
                    j += 1
                    name = f"{base}_{j}{ext}"
                used.add(name)
                zf.writestr(f"{folder}/{name}", data)
                count += 1
    if count == 0:
        raise HTTPException(404, "내려받을 승인된 사진이 없습니다.")
    tmp.seek(0)
    y, mo = month.split("-")
    fname = f"행복한요양원_앨범사진_{y}.{mo}.zip"

    def iterfile():
        while True:
            chunk = tmp.read(1024 * 1024)
            if not chunk:
                break
            yield chunk
        tmp.close()

    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{_q(fname)}",
        "X-Photo-Count": str(count),
        "X-Skipped": str(skipped),
    }
    return StreamingResponse(iterfile(), media_type="application/zip", headers=headers)
