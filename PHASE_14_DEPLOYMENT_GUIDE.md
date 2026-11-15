# UDIP Phase 14 — Production Deployment & Runtime Operations Guide

**Project:** Universal Document Intelligence Platform (UDIP)  
**Date:** November 15, 2026  
**Architecture:** Microservices / Split Frontend & Backend Architecture  
**Runtime:** Node.js 20+ (Next.js 16) / Python 3.11+ (FastAPI + Uvicorn)

---

## 1. Environment Configuration

UDIP configurations are centralized within `.env` and loaded dynamically via `pydantic-settings`.

### 1.1 Backend Production Variables (`backend/.env` or root `.env`)
```ini
# Runtime
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
SECRET_KEY=<32-byte-cryptographically-secure-random-hex>

# Allowed CORS Origins
ALLOWED_ORIGINS=["https://app.udip.com","https://udip.com"]

# Database & Vector Store (PostgreSQL 16 + pgvector)
DATABASE_URL=postgresql+asyncpg://postgres:securepass@db.internal:5432/udip_db
DATABASE_SYNC_URL=postgresql+psycopg://postgres:securepass@db.internal:5432/udip_db
DB_POOL_SIZE=20
VECTOR_DIMENSION=384

# Authentication
AUTH_PROVIDER=local_or_supabase
ALLOW_DEV_AUTH=false
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=<supabase-jwt-secret>

# Storage Provider (local or S3/Supabase Storage)
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=/var/data/udip/documents
MAX_UPLOAD_SIZE_BYTES=26214400

# Google Gemini AI
LLM_PROVIDER=gemini
LLM_MODEL_NAME=gemini-3-flash-preview
LLM_TIMEOUT_SECONDS=90.0
GEMINI_API_KEY=<your-google-gemini-api-key>
```

### 1.2 Frontend Environment Variables (`frontend/.env.production`)
```ini
NEXT_PUBLIC_APP_NAME="UDIP"
NEXT_PUBLIC_API_URL="https://api.udip.com"
```

---

## 2. Database Migration Steps

Run Alembic migrations to apply all 5 revisions up to head:

```bash
cd backend
alembic upgrade head
```

Verify migration status:
```bash
alembic current
# Expected head revision: 20261115_0005 (Add password_hash column to users)
```

---

## 3. Production Service Launch

### 3.1 Backend FastAPI Service (Uvicorn + Gunicorn Workers)
```bash
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

### 3.2 Ingestion Worker Runner
```bash
python -m app.services.worker.runner
```

### 3.3 Frontend Next.js Service
```bash
cd frontend
npm run build
npm run start -- -p 3000
```

---

## 4. Health Probes & Monitoring

The backend exposes automated health and probe endpoints for Kubernetes / Docker orchestrators:
- **Liveness Probe:** `GET /health/live` (Returns HTTP 200 `{ "status": "alive" }`)
- **Readiness Probe:** `GET /health/ready` (Validates database connection pool & storage read/write)
- **Detailed System Health:** `GET /api/v1/health` (Reports active providers, database health, vector engine, and uptime)
