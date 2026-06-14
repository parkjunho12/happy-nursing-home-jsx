"""
로컬 uploads/albums → Cloudflare R2 마이그레이션 스크립트

실행 전 .env 파일에 R2 설정 필수:
  R2_ACCOUNT_ID=...
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  R2_BUCKET_NAME=happy-nursing-home-albums
  R2_PUBLIC_URL=https://pub-xxxx.r2.dev

실행:
  cd backend
  python -m scripts.migrate_to_r2
"""
import sys, os, mimetypes
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.album import AlbumMedia, Album
from app.services.r2_storage import (
    _get_client, _r2_key, _make_cdn_url, _make_thumbnail,
)

LOCAL_UPLOAD_DIR = "uploads/albums"


def migrate():
    # R2 설정 확인
    if not settings.R2_CONFIGURED:
        print("❌ R2 설정이 .env에 없습니다.")
        print("   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY를 설정해주세요.")
        sys.exit(1)

    print(f"🪣 버킷: {settings.R2_BUCKET_NAME}")
    print(f"🌐 공개 URL: {settings.R2_PUBLIC_URL}")
    print()

    db     = SessionLocal()
    client = _get_client()

    media_list = db.query(AlbumMedia).all()
    total = len(media_list)
    print(f"총 {total}개 파일 마이그레이션 시작\n")

    success = 0
    skip    = 0
    fail    = 0

    for i, m in enumerate(media_list, 1):
        print(f"[{i}/{total}] {m.file_name or m.id[:8]}", end=" ... ")

        # 이미 R2 URL이면 스킵
        if m.file_url and settings.R2_PUBLIC_URL and settings.R2_PUBLIC_URL in m.file_url:
            print("이미 R2 ✓")
            skip += 1
            continue
        if m.file_url and m.file_url.startswith("r2://"):
            print("이미 R2 ✓")
            skip += 1
            continue

        # 로컬 파일 경로 (/uploads/albums/... → uploads/albums/...)
        local_path = m.file_url.lstrip("/") if m.file_url else None
        if not local_path or not os.path.exists(local_path):
            print(f"파일 없음 ✗ ({local_path})")
            fail += 1
            continue

        try:
            ext  = os.path.splitext(local_path)[1].lower()
            mime = mimetypes.guess_type(local_path)[0] or "application/octet-stream"

            with open(local_path, "rb") as f:
                data = f.read()

            # 기존 UUID를 R2 키에 재사용 (DB 일관성 유지)
            key = _r2_key(m.album_id, m.id, ext)

            # 원본 R2 업로드
            client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=data,
                ContentType=mime,
            )
            new_url = _make_cdn_url(key)

            # 썸네일 생성 & 업로드 (이미지이고 아직 썸네일 없을 때)
            new_thumb = m.thumbnail_url or ""
            if m.media_type == "photo" and not m.thumbnail_url:
                thumb_data = _make_thumbnail(data, ext)
                if thumb_data:
                    thumb_key = _r2_key(m.album_id, m.id, ".webp", is_thumb=True)
                    client.put_object(
                        Bucket=settings.R2_BUCKET_NAME,
                        Key=thumb_key,
                        Body=thumb_data,
                        ContentType="image/webp",
                    )
                    new_thumb = _make_cdn_url(thumb_key)

            # DB 업데이트
            m.file_url      = new_url
            m.thumbnail_url = new_thumb or m.thumbnail_url
            db.add(m)

            # 앨범 커버 URL도 업데이트
            album = db.query(Album).filter(Album.id == m.album_id).first()
            if album and album.cover_url and local_path in album.cover_url:
                album.cover_url = new_thumb or new_url
                db.add(album)

            db.commit()
            print(f"완료 ✓  → {new_url[:70]}")
            success += 1

        except Exception as e:
            db.rollback()
            print(f"실패 ✗  {e}")
            fail += 1

    db.close()

    print(f"\n{'='*55}")
    print(f"완료: {success}개  |  스킵: {skip}개  |  실패: {fail}개")
    print(f"{'='*55}")

    if fail == 0 and success > 0:
        print("\n✅ 마이그레이션 성공!")
        print("   로컬 파일 확인 후 직접 삭제하세요:")
        print(f"   rm -rf {LOCAL_UPLOAD_DIR}")
    elif fail > 0:
        print(f"\n⚠️  {fail}개 파일 실패. 위 로그를 확인하세요.")
    else:
        print("\n이미 모두 R2에 있습니다.")


if __name__ == "__main__":
    migrate()
