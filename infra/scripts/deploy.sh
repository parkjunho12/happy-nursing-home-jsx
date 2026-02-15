#!/bin/bash

# 배포 스크립트
set -e

echo "🚀 Starting deployment..."

# 1. Git pull
echo "📦 Pulling latest code..."
git pull origin main

# 2. Backend 재빌드 및 재시작
echo "🔨 Rebuilding backend..."
cd infra
docker-compose build backend

echo "🔄 Restarting services..."
docker-compose up -d --force-recreate backend

# 3. 헬스 체크
echo "🏥 Health check..."
sleep 5
curl -f http://localhost:8000/health || exit 1

echo "✅ Deployment completed successfully!"