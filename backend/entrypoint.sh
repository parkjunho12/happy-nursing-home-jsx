#!/usr/bin/env sh
set -e

echo "[entrypoint] waiting for DB..."
until pg_isready -h postgres -p 5432 -U "$POSTGRES_USER" >/dev/null 2>&1; do
  sleep 1
done

echo "[entrypoint] running alembic migrations..."
alembic upgrade head

# ---- Seed 실행 (선택적) ----
if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] running seed script..."
  python /app/seed.py
else
  echo "[entrypoint] seed skipped"
fi

echo "[entrypoint] starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

