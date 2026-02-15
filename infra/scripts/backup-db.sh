#!/bin/bash

# 데이터베이스 백업 스크립트
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nursing_home_${DATE}.sql"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# PostgreSQL 백업
docker-compose exec -T postgres pg_dump -U nursing_admin nursing_home_prod > "${BACKUP_DIR}/${BACKUP_FILE}"

# 압축
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "✅ Backup completed: ${BACKUP_FILE}.gz"