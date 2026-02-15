# 🏥 행복한요양원 - Hybrid Architecture

공개 웹사이트(Next.js/Vercel) + 운영시스템(FastAPI/VPS) 분리 아키텍처

## 🏗️ 아키텍처

```
┌─────────────────┐         ┌──────────────────────┐
│  Public Web     │         │   Operations (VPS)   │
│  (Vercel)       │         │                      │
│  - Next.js      │◄────────┤  - FastAPI Backend   │
│  - 소개/후기    │  API    │  - PostgreSQL        │
│  - 상담신청     │  Calls  │  - Admin UI (React)  │
└─────────────────┘         │  - Caddy (TLS)       │
                            └──────────────────────┘
```

## 📁 구조

```
nursing-home/
├── apps/
│   ├── web/        # Next.js 공개 웹사이트
│   └── admin/      # React Admin SPA
├── backend/        # FastAPI 운영시스템
├── infra/          # Docker Compose, Scripts
└── .github/        # CI/CD workflows
```

## 🚀 빠른 시작

### 로컬 개발

```bash
# 의존성 설치
pnpm install

# 공개 웹 개발서버
pnpm dev:web

# Admin 개발서버
pnpm dev:admin

# Backend 개발서버
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 프로덕션 배포

1. **Vercel (공개 웹)**
   - GitHub 연동으로 자동 배포
   - 도메인: www.행복한요양원녹양역.com

2. **VPS (백엔드 + Admin)**
   ```bash
   # VPS에서 실행
   cd infra
   docker-compose up -d
   ```

## 🌐 도메인

| 서비스 | 도메인 | 위치 |
|--------|--------|------|
| 공개 웹 | www.행복한요양원녹양역.com | Vercel |
| API | api.행복한요양원녹양역.com | VPS |
| Admin | admin.행복한요양원녹양역.com | VPS |

## 📖 문서

- [배포 가이드](./docs/DEPLOYMENT.md)
- [API 문서](./docs/API.md)
- [개발 가이드](./docs/DEVELOPMENT.md)

## 🔒 보안

- JWT 인증 (httpOnly cookie)
- CORS 제한
- Rate limiting
- Auto TLS (Caddy)
- Audit logging

## 📞 Contact

문의: admin@nursing-home.com