# ==============================================================================
# UDIP Backend - Production Multi-Stage Dockerfile (Python 3.13)
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM python:3.13-slim AS builder

WORKDIR /build

# Install build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies into wheels or virtualenv
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


# --- Stage 2: Final Runtime Image ---
FROM python:3.13-slim AS runner

# Security: Never run containers as root
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/bash -m appuser

# Install runtime dependencies: curl for healthchecks, tesseract for OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application source code and migrations
COPY --chown=appuser:appgroup alembic.ini .
COPY --chown=appuser:appgroup alembic ./alembic
COPY --chown=appuser:appgroup app ./app

# Prepare storage directory with correct permissions
RUN mkdir -p /app/storage/documents && \
    chown -R appuser:appgroup /app/storage

# Environment variables
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

# Switch to non-root user
USER appuser

EXPOSE 8000

# Container liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

# Production server entrypoint
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
