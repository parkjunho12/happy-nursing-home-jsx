#!/usr/bin/env sh
set -e

echo "[entrypoint] waiting for DB..."
until pg_isready -h postgres -p 5432 -U "$POSTGRES_USER" >/dev/null 2>&1; do
  sleep 1
done

echo "[entrypoint] running alembic migrations..."
# 여러 프로세스가 동시에 마이그레이션하지 못하게 DB 자문 잠금으로 직렬화한다.
# (배포 스크립트·컨테이너 재시작이 겹쳐도 한 번에 하나만 실행됨)
python - <<'PYEOF'
import os, sys, subprocess
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"].replace("+psycopg2", ""))
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT pg_advisory_lock(727272)")   # 프로젝트 고유 키
try:
    r = subprocess.run(["alembic", "upgrade", "head"])
    sys.exit(r.returncode)
finally:
    cur.execute("SELECT pg_advisory_unlock(727272)")
    conn.close()
PYEOF

# ---- Seed 실행 (선택적) ----
if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] running seed script..."
  python /app/seed.py
else
  echo "[entrypoint] seed skipped"
fi

echo "[entrypoint] starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

