FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# --no-install-recommends 를 쓰면 이미지는 작아지지만, gcc 가 딸고 오던
# libc 헤더가 빠져 psutil 같은 C 확장 빌드가 깨진다. 그래서 libc6-dev 를 직접 적는다.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    postgresql-client \
    # 방송 음원 처리 — 길이 측정과 음량 정규화에 쓴다.
    # 없으면 업로드 음원이 TTS 보다 작게 나가고, 최대 방송시간 검사도 못 한다.
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /entrypoint.sh
USER appuser

# Expose port
EXPOSE 8000

# Run application (entrypoint에서 migrate 후 uvicorn)
CMD ["/entrypoint.sh"]
