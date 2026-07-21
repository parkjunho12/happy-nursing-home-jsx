#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 행복한요양원 DB·업로드 백업
#
# 왜 다시 썼나:
#  - 이전 버전은 접속 정보가 하드코딩(nursing_admin)되어 실제 .env와 달랐고,
#    pg_dump가 실패해도 빈 파일을 gzip한 뒤 "완료"를 출력했다.
#    백업이 "있다고 믿었는데 열어보니 빈 파일"이 최악의 시나리오라
#    실패는 반드시 소리 나게, 성공은 검증 후에만 보고한다.
#
# 하는 일:
#  1) pg_dump (custom format) → pg_restore --list 로 무결성 검증
#  2) 업로드 파일(인수인계 사진·공지 이미지) — 일요일마다 tar
#  3) 보관: DB 14일 · 업로드 28일 지난 것 삭제
#
# 설치(서버에서 1회):
#   chmod +x /opt/happy/infra/scripts/backup-db.sh
#   crontab -e  →  30 3 * * * /opt/happy/infra/scripts/backup-db.sh >> /var/log/happy-backup.log 2>&1
# ─────────────────────────────────────────────────────────────
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/opt/happy/backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="${DB_CONTAINER:-happy_db}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-happy_backend}"
MIN_BYTES=10240     # 이보다 작으면 실패로 간주 (빈 덤프 방지)

fail() { echo "❌ 백업 실패: $1" >&2; exit 1; }

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"

# ── 1) DB 덤프 — 접속 정보는 컨테이너 환경변수에서 (하드코딩 금지)
DB_FILE="$BACKUP_DIR/db/happy_${STAMP}.dump"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DB_FILE" \
  || fail "pg_dump 실행 실패 (컨테이너 $DB_CONTAINER)"

SIZE=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE")
[ "$SIZE" -ge "$MIN_BYTES" ] || fail "덤프가 너무 작음(${SIZE}B) — 빈 백업 의심: $DB_FILE"

# 덤프 목차가 읽히는지 확인 — 깨진 파일이면 여기서 걸린다
docker exec -i "$DB_CONTAINER" pg_restore --list > /dev/null < "$DB_FILE" \
  || fail "덤프 무결성 검증 실패: $DB_FILE"

# ── 2) 업로드 파일 — 일요일에만 (사진이라 용량이 큼)
if [ "$(date +%u)" = "7" ]; then
  UP_FILE="$BACKUP_DIR/uploads/uploads_${STAMP}.tar.gz"
  docker run --rm --volumes-from "$BACKEND_CONTAINER" -v "$BACKUP_DIR/uploads:/backup" \
    alpine tar czf "/backup/uploads_${STAMP}.tar.gz" -C /app uploads \
    || fail "업로드 백업 실패"
  echo "  업로드 백업: $UP_FILE ($(du -h "$UP_FILE" | cut -f1))"
fi

# ── 3) 보관 정책
find "$BACKUP_DIR/db" -name "*.dump" -mtime +14 -delete
find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +28 -delete

echo "✅ $(date '+%F %T') DB 백업 완료: $DB_FILE ($(du -h "$DB_FILE" | cut -f1)) · 보관 $(ls "$BACKUP_DIR/db" | wc -l)개"
