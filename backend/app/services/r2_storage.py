"""
Cloudflare R2 스토리지 서비스
- boto3 S3 호환 API 사용
- 업로드: R2에 직접 저장
- 다운로드: presigned URL 발급 (5분 만료) → CORS 완전 우회
- 삭제: R2에서 오브젝트 삭제
- 썸네일: Pillow로 이미지 리사이징 후 R2에 함께 저장
"""
import os
import uuid
import io
import mimetypes
from datetime import timedelta
from typing import Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import UploadFile, HTTPException

# ── 설정 (config.py Settings에서 읽음) ──────────────────────────────────────
from app.core.config import settings as _settings

def _cfg():
    return _settings

# 하위 호환 편의 프로퍼티
def _account_id():        return _settings.R2_ACCOUNT_ID
def _access_key():        return _settings.R2_ACCESS_KEY_ID
def _secret_key():        return _settings.R2_SECRET_ACCESS_KEY
def _bucket():            return _settings.R2_BUCKET_NAME
def _public_url():        return _settings.R2_PUBLIC_URL
def _presign_expire():    return _settings.R2_PRESIGN_EXPIRE

ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi'}
VIDEO_EXT   = {'.mp4', '.mov', '.avi'}
IMAGE_EXT   = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}

THUMB_SIZE  = (480, 480)   # 썸네일 최대 크기
THUMB_QUALITY = 80          # WebP 품질


def _get_client():
    """R2 S3 호환 클라이언트"""
    if not _account_id():
        raise RuntimeError("R2_ACCOUNT_ID 환경변수가 설정되지 않았습니다")
    return boto3.client(
        "s3",
        endpoint_url=_settings.R2_ENDPOINT_URL,
        aws_access_key_id=_access_key(),
        aws_secret_access_key=_secret_key(),
        config=Config(
            signature_version="s3v4",
            region_name="auto",
        ),
    )


def _r2_key(album_id: str, file_id: str, ext: str, is_thumb: bool = False) -> str:
    """R2 오브젝트 키 생성: albums/{album_id}/{file_id}.ext"""
    prefix = "thumbnails" if is_thumb else "albums"
    return f"{prefix}/{album_id}/{file_id}{ext}"


def _make_cdn_url(key: str) -> str:
    """R2 CDN URL 생성 (커스텀 도메인 또는 r2.dev)"""
    if _public_url():
        return f"{_public_url().rstrip('/')}/{key}"
    return f"r2://{_bucket()}/{key}"   # fallback (presigned 사용 권장)


def _make_thumbnail(data: bytes, ext: str) -> Optional[bytes]:
    """이미지 썸네일 생성 (WebP 480x480)"""
    if ext.lower() not in IMAGE_EXT:
        return None
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=THUMB_QUALITY)
        return buf.getvalue()
    except Exception:
        return None   # PIL 없거나 실패 시 썸네일 스킵


class R2Storage:
    """R2 스토리지 작업 클래스"""

    def upload_file(
        self,
        file: UploadFile,
        album_id: str,
    ) -> Tuple[str, str, str, int]:
        """
        파일을 R2에 업로드
        Returns: (file_url, thumbnail_url, media_type, file_size)
        """
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"지원하지 않는 파일 형식: {ext}")

        file_id    = str(uuid.uuid4())
        media_type = "video" if ext in VIDEO_EXT else "photo"
        mime_type  = mimetypes.guess_type(f"file{ext}")[0] or "application/octet-stream"

        # 파일 읽기
        data = file.file.read()
        file_size = len(data)

        client = _get_client()

        # 원본 업로드
        key = _r2_key(album_id, file_id, ext)
        client.put_object(
            Bucket=_bucket(),
            Key=key,
            Body=data,
            ContentType=mime_type,
        )

        file_url = _make_cdn_url(key)

        # 썸네일 업로드 (이미지만)
        thumb_url = ""
        thumb_data = _make_thumbnail(data, ext)
        if thumb_data:
            thumb_key = _r2_key(album_id, file_id, ".webp", is_thumb=True)
            client.put_object(
                Bucket=_bucket(),
                Key=thumb_key,
                Body=thumb_data,
                ContentType="image/webp",
            )
            thumb_url = _make_cdn_url(thumb_key)

        return file_url, thumb_url, media_type, file_size

    def delete_file(self, file_url: str, thumbnail_url: Optional[str] = None) -> None:
        """R2에서 파일 삭제"""
        if not file_url:
            return
        client = _get_client()

        # file_url에서 key 추출
        # R2_PUBLIC_URL 방식: https://cdn.example.com/albums/...
        # r2:// 방식: r2://bucket/albums/...
        def _extract_key(url: str) -> Optional[str]:
            if not url:
                return None
            if url.startswith("r2://"):
                return url.split("/", 3)[-1]
            if _public_url() and url.startswith(_public_url()):
                return url[len(_public_url()):].lstrip("/")
            # 기존 로컬 경로 (/uploads/albums/...) 는 무시
            if url.startswith("/uploads/"):
                return None
            return None

        for url in [file_url, thumbnail_url]:
            key = _extract_key(url or "")
            if key:
                try:
                    client.delete_object(Bucket=_bucket(), Key=key)
                except ClientError:
                    pass   # 없어도 무시

    def presigned_download_url(
        self,
        file_url: str,
        file_name: str,
        expires_in: Optional[int] = None,
    ) -> str:
        """
        보호자 다운로드용 presigned URL 발급 (기본 5분)
        - Content-Disposition: attachment → 강제 저장
        - CORS 없이 브라우저 직접 다운로드 가능
        """
        if expires_in is None:
            expires_in = _presign_expire()
        key = None
        if file_url.startswith("r2://"):
            key = file_url.split("/", 3)[-1]
        elif _public_url() and file_url.startswith(_public_url()):
            key = file_url[len(_public_url()):].lstrip("/")

        if not key:
            # 로컬 파일이거나 키를 추출 못 하면 원본 URL 반환
            return file_url

        client = _get_client()
        try:
            safe_name = file_name.encode("utf-8").decode("ascii", errors="replace")
            url = client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": _bucket(),
                    "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{safe_name}"',
                },
                ExpiresIn=expires_in,
            )
            return url
        except ClientError as e:
            raise HTTPException(500, f"다운로드 URL 생성 실패: {e}")

    def is_configured(self) -> bool:
        """R2 환경변수가 설정되어 있는지 확인"""
        return _settings.R2_CONFIGURED


# 싱글톤
r2 = R2Storage()
