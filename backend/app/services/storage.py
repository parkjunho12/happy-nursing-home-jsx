"""공용 업로드 스토리지 — Cloudflare R2 우선, 미설정이면 로컬 디스크.

배경: 인수인계 사진·공지 이미지·시설소식·지출 증빙이 전부 서버 디스크
(uploads/)에 쌓여 정리 정책 없이 커지고 있었다. 앨범이 이미 R2를 쓰고
있으므로 같은 버킷을 폴더로 나눠 함께 쓴다.

원칙:
 - 반환 URL은 항상 그대로 <img src>에 넣을 수 있는 형태.
   R2면 절대 URL(https://…), 로컬이면 /uploads/… (프론트 헬퍼가 둘 다 처리)
 - R2 자격이 없으면(개발 환경) 로컬로 조용히 폴백하되 로그는 남긴다.
 - 기존에 저장된 /uploads/… 경로는 그대로 두고 계속 서빙한다. (마이그레이션 불필요)
"""
from __future__ import annotations
import logging
import mimetypes
import os
import uuid
from typing import Optional

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# 장당 크기 상한 — 휴대폰 원본 사진(약 3~8MB)은 통과, 실수로 올린 동영상은 차단
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


def _r2_ready() -> bool:
    return bool(settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID
                and settings.R2_SECRET_ACCESS_KEY and settings.R2_BUCKET_NAME
                and settings.R2_PUBLIC_URL)


def save_upload(data: bytes, folder: str, filename: Optional[str],
                content_type: Optional[str] = None) -> str:
    """바이트를 저장하고 표시용 URL을 돌려준다.

    folder: 'handover' | 'notices' | 'news' | 'expenses' 등 (버킷 안 폴더)
    """
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f"파일이 너무 큽니다 (최대 {MAX_UPLOAD_MB}MB). "
                                 f"사진 앱에서 크기를 줄여 다시 올려주세요.")
    ext = os.path.splitext(filename or "")[1].lower() or ".bin"
    key = f"{folder}/{uuid.uuid4()}{ext}"
    ctype = content_type or mimetypes.guess_type(f"f{ext}")[0] or "application/octet-stream"

    if _r2_ready():
        try:
            from app.services.r2_storage import _get_client, _bucket, _make_cdn_url
            _get_client().put_object(Bucket=_bucket(), Key=key, Body=data, ContentType=ctype)
            return _make_cdn_url(key)
        except Exception as e:
            # R2 장애 때 업로드 기능 전체가 죽으면 안 된다 — 로컬로 내려앉되 크게 남긴다
            logger.error("R2 업로드 실패, 로컬로 폴백: %s", e)

    local_dir = os.path.join("uploads", folder)
    os.makedirs(local_dir, exist_ok=True)
    disk = key.split("/", 1)[1]
    with open(os.path.join(local_dir, disk), "wb") as out:
        out.write(data)
    return f"/uploads/{folder}/{disk}"


def delete_upload(url: Optional[str]) -> None:
    """저장된 URL의 실제 파일을 지운다. R2·로컬 모두 처리, 실패는 로그만."""
    if not url:
        return
    try:
        pub = (settings.R2_PUBLIC_URL or "").rstrip("/")
        if pub and url.startswith(pub + "/"):
            from app.services.r2_storage import _get_client, _bucket
            _get_client().delete_object(Bucket=_bucket(), Key=url[len(pub) + 1:])
            return
        if url.startswith("/uploads/"):
            path = url.lstrip("/")
            if os.path.isfile(path):
                os.remove(path)
    except Exception as e:
        logger.warning("업로드 파일 삭제 실패(무시): %s → %s", url, e)
