# UDIP Production Deployment Guide

This guide details the deployment of the **Universal Document Intelligence Platform (UDIP)** in production environments, specifically optimized for single-node VPS installations (e.g. 8 GB RAM, 2-4 vCPUs) or containerized cloud infrastructure.

---

## 1. Production Architecture

```
                    Internet (Users)
                           │
                           ▼ HTTPS (Port 443)
              ┌─────────────────────────┐
              │   Nginx Reverse Proxy   │
              └────────────┬────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │  Next.js 16 UI  │         │ FastAPI Backend │
    │   (Port 3000)   │         │   (Port 8000)   │
    └─────────────────┘         └────────┬────────┘
                                         │
                   ┌─────────────────────┼─────────────────────┐
                   ▼                     ▼                     ▼
          ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
          │  PostgreSQL 16  │   │ Durable Worker  │   │ Object Storage  │
          │   (+pgvector)   │   │  (Ingestion)    │   │ (Supabase/Local)│
          └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 2. Prerequisites & Resource Allocation

| Component | Minimum Allocation | Target Allocation (8 GB VPS) | Notes |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 16 + pgvector** | 1.0 vCPU, 1 GB RAM | 1.0 vCPU, 1.5 GB RAM | Max 50 connections |
| **FastAPI Backend** | 1.0 vCPU, 1 GB RAM | 1.5 vCPU, 2.0 GB RAM | 2 Uvicorn workers |
| **Durable Worker** | 0.5 vCPU, 1 GB RAM | 1.0 vCPU, 2.0 GB RAM | Concurrency limit = 3 |
| **Next.js 16 Frontend** | 0.5 vCPU, 512 MB RAM| 1.0 vCPU, 1.0 GB RAM | Node.js standalone |
| **Nginx Proxy** | 0.2 vCPU, 128 MB RAM| 0.5 vCPU, 256 MB RAM | Gzip + TLS termination |
| **System Reserve** | - | 1.25 GB RAM | Kernel & cache |
| **Total** | **3.0 vCPU, 3.6 GB** | **4.0 vCPU, 8.0 GB** | **Optimal on 8 GB RAM** |

---

## 3. Step-by-Step Deployment (Docker Compose)

### Step 3.1: Clone and Prepare Environment
```bash
git clone https://github.com/your-org/universal-document-intelligence.git /opt/udip
cd /opt/udip

# Create production environment configuration
cp .env.production.example .env.production
```

### Step 3.2: Configure Secrets in `.env.production`
Generate a cryptographically secure 256-bit key:
```bash
openssl rand -hex 32
```
Edit `.env.production` and configure:
```ini
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<paste_generated_32_char_hex_key>
ALLOW_DEV_AUTH=false

POSTGRES_USER=udip_admin
POSTGRES_PASSWORD=<secure_database_password>
DATABASE_URL=postgresql+asyncpg://udip_admin:<secure_database_password>@postgres:5432/udip_db
DATABASE_SYNC_URL=postgresql+psycopg://udip_admin:<secure_database_password>@postgres:5432/udip_db

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=<supabase_jwt_secret>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>

STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=udip-documents

LLM_PROVIDER=gemini
GEMINI_API_KEY=<your_gemini_api_key>
```

### Step 3.3: Launch Stack
```bash
# Build and start all production services in the background
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 3.4: Apply Database Migrations
Run Alembic schema migrations inside the running backend container:
```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## 4. SSL Termination with Let's Encrypt (Certbot)

To configure free SSL certificates for your domain (e.g. `udip.yourdomain.com`):
```bash
# 1. Obtain certificate via standalone certbot
docker run -it --rm --name certbot \
  -v "/opt/udip/certbot_conf:/etc/letsencrypt" \
  -v "/opt/udip/certbot_www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d udip.yourdomain.com

# 2. Reload Nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 5. Deployment Verification Checklist

Verify that all subsystems are healthy and operational:

```bash
# 1. Liveness check (HTTP 200)
curl -i http://localhost/health/live

# 2. Readiness check (Database ping, storage, vector engine)
curl -i http://localhost/health/ready

# 3. Prometheus metrics output
curl -i http://localhost/metrics

# 4. View real-time container logs
docker compose -f docker-compose.prod.yml logs -f --tail=50
```
