#!/usr/bin/env bash
# DB 복원 — 백업이 있어도 복원 절차를 모르면 소용없다.
# 사용법: ./restore-db.sh /opt/happy/backups/db/happy_20260721_033000.dump
set -euo pipefail
DUMP="${1:?사용법: restore-db.sh <덤프파일>}"
DB_CONTAINER="${DB_CONTAINER:-happy_db}"
[ -f "$DUMP" ] || { echo "파일 없음: $DUMP"; exit 1; }

echo "⚠ 현재 DB를 '$DUMP' 시점으로 되돌립니다. 진행하려면 RESTORE 라고 입력:"
read -r ANSWER
[ "$ANSWER" = "RESTORE" ] || { echo "중단"; exit 1; }

# --clean --if-exists: 기존 객체를 지우고 덤프 내용으로 재생성
docker exec -i "$DB_CONTAINER" sh -c \
  'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DUMP"
echo "✅ 복원 완료 — 백엔드 재시작을 권장합니다: docker compose restart backend"

