# UDIP — Phase 11 Production Deployment Guide

**Platform:** Universal Document Intelligence Platform (UDIP)  
**System:** Gemini NotebookLM Platform & Studio Engines  
**Date:** November 14, 2026  
**Document Version:** 1.0  
**Architect:** UDIP DevOps & Security Engineering Team  

---

## 1. System Requirements & Hardware Constraints

UDIP is engineered for CPU-first execution within an **8 GB RAM** target envelope.

| Component | Minimum Spec | Recommended Spec |
| :--- | :--- | :--- |
| **CPU** | 2 vCPUs (x86_64 or ARM64) | 4 vCPUs |
| **RAM** | 8 GB System Memory | 16 GB System Memory |
| **Storage** | 20 GB SSD | 50+ GB NVMe SSD |
| **OS** | Linux (Ubuntu 22.04 LTS / Debian 12) or Windows 11 | Ubuntu 22.04 LTS |
| **Runtimes** | Python 3.13+, Node.js 20+ (LTS), Docker 24+ | Python 3.13, Node.js 20.x, Docker 26+ |

---

## 2. Environment Configuration

Create a `.env.production` file in the project root:

```env
# =====================================================================
# Core Application Settings
# =====================================================================
ENVIRONMENT="production"
DEBUG="false"
APP_NAME="Universal Document Intelligence Platform"
API_V1_PREFIX="/api/v1"
SECRET_KEY="<generate-random-64-character-hex-string>"

# =====================================================================
# Database & Vector Storage (PostgreSQL 16 + pgvector)
# =====================================================================
DATABASE_URL="postgresql+asyncpg://udip_user:your-postgres-password@postgres:5432/udip_db"
DATABASE_SYNC_URL="postgresql://udip_user:your-postgres-password@postgres:5432/udip_db"

# =====================================================================
# Google Gemini API Configuration
# =====================================================================
GEMINI_API_KEY="AIzaSyYourProductionGeminiAPIKeyHere"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_FALLBACK_MODEL="gemini-1.5-flash"
GEMINI_DEFAULT_TEMPERATURE="0.2"
GEMINI_MAX_OUTPUT_TOKENS="4096"

# =====================================================================
# Storage Configuration
# =====================================================================
STORAGE_BACKEND="local" # or "supabase"
STORAGE_LOCAL_DIR="/var/lib/udip/storage"

# =====================================================================
# Security & Rate Limiting
# =====================================================================
ALLOW_DEV_AUTH="false"
CORS_ORIGINS='["https://udip.yourdomain.com"]'
RATE_LIMIT_PER_MINUTE="120"
```

---

## 3. Database Migration Execution

Execute Alembic migrations to apply all 4 schema versions (including Phase 11 notebooks and studio tables):

```bash
# Inside the backend environment or container:
cd backend
alembic upgrade head
```

Verify that all tables have been provisioned:
- `notebooks`
- `notebook_sources`
- `notebook_notes`
- `studio_artifacts`
- `audio_generations`
- `presentations`
- `mind_maps`
- `reports`
- `flashcard_decks`
- `quizzes`
- `infographics`
- `data_tables`
- `video_generations`

---

## 4. Production Multi-Container Deployment (Docker Compose)

Launch the production stack using `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Container Services Breakdown
1. **`postgres`:** PostgreSQL 16 with pgvector extension (`pgvector/pgvector:pg16`).
2. **`backend`:** FastAPI async API server running with Uvicorn workers (`gunicorn -k uvicorn.workers.UvicornWorker app.main:app`).
3. **`worker`:** Background ingestion daemon (`python -m app.services.worker.runner`).
4. **`frontend`:** Next.js 16 standalone Node.js production server.
5. **`nginx`:** TLS termination, reverse proxy, SSE streaming buffer bypass (`proxy_buffering off`), and rate limiting.

### Nginx Critical Directives for SSE Streaming
To ensure Gemini conversational tokens stream without buffering, verify the following configuration in `nginx/nginx.conf`:

```nginx
location /api/v1/chat/ {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
}
```

---

## 5. Health Probes & Monitoring

The deployment includes production health probes and metrics for Kubernetes or Docker health checks:

| Probe Endpoint | Purpose | Expected Status |
| :--- | :--- | :---: |
| `GET /api/v1/health` | Comprehensive application health (DB, Storage, LLM) | 200 OK |
| `GET /api/v1/health/live` | Liveness probe (Process responsiveness) | 200 OK |
| `GET /api/v1/health/ready` | Readiness probe (DB connectivity & tables accessible) | 200 OK |
| `GET /api/v1/health/metrics` | Prometheus metrics exposition | 200 OK |

---

## 6. Day-2 Maintenance & Backup Runbook

### Database Backup
```bash
docker exec -t udip-postgres pg_dump -U udip_user udip_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Storage Backup
```bash
tar -czf storage_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/lib/udip/storage
```

### Rollback Procedure
If a database rollback is required:
```bash
cd backend
alembic downgrade -1
```
