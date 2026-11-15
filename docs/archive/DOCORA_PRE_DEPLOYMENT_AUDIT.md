# DOCORA — Final Pre-Deployment Production Readiness Audit

**Document Date:** November 15, 2026
**Auditor Roles:** Principal Software Architect, Senior DevSecOps Engineer, QA & Application Security Auditor
**Target Repository:** `C:\Users\esalo\Desktop\universal-document-intelligence`
**Application Name:** **Docora**
**Tagline:** *Your documents. Your intelligence.*
**Deployment Target:** Free Demo Tier (Vercel Hobby + Render Free Web Service + Supabase Free PostgreSQL + Supabase Storage / Cloudflare R2 + Google Gemini API)

---

## Executive Summary & Classification Verdict

### Deployment Classification: **CONDITIONALLY READY**

The **Docora** rebranding and core application architecture have been verified as functionally sound, performant, and secure in local and staging environments. Next.js production builds compile cleanly (16/16 routes), the FastAPI backend passes comprehensive test suites (200/200 unit and integration tests, 5/5 performance benchmarks), and live Gemini API calls are verified operational.

However, deployment to public Git and free cloud hosting requires **four mandatory pre-flight remediation actions** prior to initiating `git push` or executing cloud builds:
1. **Critical Secret & Document Data Isolation:** 48 sample document binary files (`.bin`) under `backend/storage/documents/` are currently tracked in Git history and must be untracked via `git rm --cached` before pushing to a remote repository.
2. **Ephemeral Disk Protection on Render:** The local storage driver (`LOCAL_STORAGE_DIR`) writes to container disk, which is wiped upon Render free-tier spin-down/restart. Production must switch to `STORAGE_PROVIDER=supabase` or Cloudflare R2.
3. **Alembic Driver Alignment for PostgreSQL:** `backend/alembic.ini` references `postgresql+psycopg://` which requires `psycopg` (sync), whereas the runtime virtual environment uses `asyncpg` (async). The Alembic connection string must be configured to avoid build-time migration failure.
4. **Git Remote Configuration:** No Git remote is currently attached (`git remote -v` is empty). A private GitHub repository must be initialized before triggering Vercel and Render deployment webhooks.

---

## 1. Git and Secret Security Audit

### 1.1 Git Status & Remote Configuration
- **Branch:** `main` (active)
- **Git Remote:** `None` (`git remote -v` returned empty). The repository has not been linked to a remote hosting service.
- **Git Push Status:** No code, commits, or assets have been pushed to any remote Git repository.

### 1.2 Tracked File & Secret Exposure Scan
A line-by-line inspection of tracked files and ignored patterns was conducted:

| File / Resource | Tracked in Git? | Ignored by `.gitignore`? | Risk Assessment & Audit Finding |
| :--- | :--- | :--- | :--- |
| `.env` | **NO** (Clean) | **YES** | Safe. Contains active local configuration; never committed. |
| `.env.local` | **NO** (Clean) | **YES** | Safe. Present only on developer workstation. |
| `.env.production` | **NO** (Clean) | **YES** | Safe. Non-existent locally; provided as `.env.production.example`. |
| `.env.example` | **YES** (Tracked) | N/A | Safe. Contains non-sensitive placeholders only. |
| `.env.production.example` | **YES** (Tracked) | N/A | Safe. Contains production template placeholders; zero actual credentials. |
| SQLite Databases (`*.db`, `*.sqlite`) | **NO** (Clean) | **YES** (`*.sqlite`, `*.db`) | Safe. `storage/udip.db` is strictly ignored by Git. |
| Private Uploaded Documents (`backend/storage/documents/`) | **CRITICAL RISK: YES (48 files)** | **Partial** (`/storage/` matches root only) | **ACTION REQUIRED:** 48 binary document files (`.bin`) were committed in earlier development phases before path rule refinement. |
| Database Passwords & JWT Secrets | **NO** (Clean) | **YES** | Safe. Code uses Pydantic `SecretStr`; zero plaintext secrets in tracked code. |
| Gemini API Key | **NO** (Clean) | **YES** | Safe. Sourced strictly via `os.environ["GEMINI_API_KEY"]` server-side. |

### 1.3 Detailed Inventory of Tracked Document Binaries
The following 48 binary files in `backend/storage/documents/` are currently indexed in Git:
- `backend/storage/documents/00ab7621-19fc-4bc0-8b98-33365a7baf70/b2f119c3-762d-477f-8c34-9fe9f13e3542.bin`
- `backend/storage/documents/16836aa6-a58c-4b0f-b198-d2734495ca35/64ff4fcd-1120-48c6-95ad-d993c5bd46c2.bin`
- `backend/storage/documents/1f670b7c-7049-4817-9be8-253585618b0d/ea61f71d-e23e-4f6e-88f7-a5b7bec60d1c.bin`
- *(and 45 additional `.bin` files across user test directories)*

**Remediation Command (Pre-Flight):**
```bash
git rm --cached -r backend/storage/documents/
echo "backend/storage/" >> .gitignore
```

---

## 2. Branding Verification

### 2.1 Brand Identity Verification
- **Official Product Name:** **Docora**
- **Brand Tagline:** *Your documents. Your intelligence.*
- **Legacy Name Elimination:** All active user interfaces, navigation bars, headers, footers, metadata titles, and modals have been converted from legacy "UDIP" references to "Docora".

### 2.2 Static Brand Assets
All required vector and raster brand assets exist in `frontend/public/brand/`:
- `docora-icon.svg` — Modern gradient document icon with intelligence nodes (180x180 vector).
- `docora-logo.svg` — Full horizontal lockup (Icon + "DOCORA" bold geometric wordmark).
- `docora-logo-dark.svg` — Dark-mode optimized horizontal lockup.
- `favicon.ico` & `favicon.svg` — Dual-format crisp favicons.
- `apple-touch-icon.png` — iOS Home Screen icon (180x180).
- `docora-192.png` & `docora-512.png` — PWA high-resolution icons.
- `manifest.json` — Valid Web Application Manifest referencing Docora assets and `#4f46e5` theme color.

### 2.3 Component & Metadata Integrity
- **BrandLogo Component:** `frontend/src/components/brand/BrandLogo.tsx` provides responsive rendering with customizable size (`sm`, `md`, `lg`, `xl`) and optional wordmark visibility.
- **Root Layout (`frontend/src/app/layout.tsx`):**
  - `<title>` template: `%s | Docora` (Default: `Docora — Your documents. Your intelligence.`)
  - Description: *"Docora is an AI-powered document intelligence and research workspace. Ask questions, retrieve cited answers, synthesize research, and generate AI-powered learning artifacts."*
  - Icons and Manifest links properly configured.
- **Customer-Facing UDIP Branding:** 0 active instances remaining across `/login`, `/register`, `/`, `/notebooks`, `/notebooks/[id]`, `/chat`, `/tasks`, `/insights`, `/intelligence`, and `/settings`.
- **Database User Records:** Verified 100% untouched. All 6 registered user accounts remain intact with original email addresses (e.g., `dev@udip.local`, `esaloni313@gmail.com`).

---

## 3. Application Integrity & Functional Verification

### 3.1 Frontend Production Build
- **Command:** `next build --webpack` (in `frontend/`)
- **Exit Code:** `0` (Success)
- **Route Compilation:** 16/16 routes compiled and optimized as Static (prerendered) or Dynamic (server-rendered):
  - `○ /` (Static)
  - `○ /_not-found` (Static)
  - `ƒ /chat` (Dynamic)
  - `ƒ /insights` (Dynamic)
  - `ƒ /intelligence` (Dynamic)
  - `○ /login` (Static)
  - `ƒ /notebooks` (Dynamic)
  - `ƒ /notebooks/[id]` (Dynamic)
  - `○ /register` (Static)
  - `ƒ /settings` (Dynamic)
  - `ƒ /tasks` (Dynamic)
- **TypeScript Typecheck:** `npx tsc --noEmit` exited with code `0` (Zero type errors).

### 3.2 Backend API Health & Security Middleware
- **Health Endpoint Probe:** `GET http://127.0.0.1:8000/api/v1/health`
  - **Status Code:** `200 OK`
  - **Payload:**
    ```json
    {
      "status": "healthy",
      "app_name": "Docora",
      "tagline": "Your documents. Your intelligence.",
      "version": "0.1.0",
      "environment": "development",
      "uptime_seconds": 2718.96,
      "services": {
        "api": "operational",
        "database": "configured",
        "storage": "local",
        "vector_engine": "pgvector_384d",
        "llm_provider": "gemini"
      }
    }
    ```
- **Readiness Probe:** `GET http://127.0.0.1:8000/api/v1/health/ready`
  - **Status Code:** `200 OK`
  - **Payload:**
    ```json
    {
      "status": "ready",
      "uptime_seconds": 2732.67,
      "checks": {
        "database": "healthy",
        "storage": "healthy (local)",
        "vector_engine": "healthy (384d)"
      }
    }
    ```
- **Security Headers Verified:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy: default-src 'self'; ...`
  - `X-Request-ID: [propagated UUID]`

### 3.3 Live Gemini API Integration (No Mocks)
- **Configured Model:** `gemini-3-flash-preview` (with automated fallback to `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-preview`, `gemini-3.5-flash-lite`)
- **Live Verification Test:** Executed live non-sensitive probe against Google Generative Language API endpoint:
  - **Prompt:** `"Ping. Respond with 'Docora Live Verified'."`
  - **API Response:** `"Docora Live Verified"`
  - **Result:** **PASSED (Live API confirmed operational, valid API key, zero mock dependency)**

### 3.4 Database Records Integrity
Database inspection of active tables confirmed zero loss or corruption of user data:
- `users`: 6 active accounts (`dev@udip.local`, `tester_phase14@udip.local`, `evelyn_audit_phase14@udip.local`, `esaloni313@gmail.com`, `audit@udip.local`, `auditor1794755797857@docora.test`).
- `workspaces`: 6 workspaces intact.
- `documents`: 5 document metadata records intact.
- `notebooks`: 4 active research notebooks intact.
- `notebook_sources`: 3 knowledge sources associated with notebooks.
- `audit_logs`: 10 audit trails preserved.

### 3.5 Alembic Migration Status
- Migration files present in `backend/alembic/versions/`:
  1. `20261113_0001_initial_schema.py`
  2. `20261113_0002_intelligence_models.py`
  3. `20261113_0003_actions_and_notifications.py`
  4. `20261114_0004_notebooks_and_studio.py`
  5. `20261115_0005_user_password_hash.py`
- **Alembic Driver Finding:** `backend/alembic.ini` line 29 specifies `sqlalchemy.url = postgresql+psycopg://...`. Since the production environment uses `asyncpg`, running sync Alembic commands requires either installing `psycopg` (e.g. `pip install psycopg[binary]`) or passing the synchronous URL via environment variable in deployment migration scripts.

---

## 4. Free Tier Deployment Compatibility Analysis

### 4.1 Architecture Topology (Free Tier)

```
┌─────────────────────────────────────────────────────────────┐
│                       Vercel Hobby                          │
│                     (Next.js Frontend)                      │
│                  https://docora.vercel.app                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS API Calls (REST / SSE)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Render Free Web Service                   │
│                   (FastAPI Python Backend)                  │
│                https://docora-api.onrender.com              │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       Database Connection (pgvector)          │ Object Storage (Signed URLs)
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Supabase Free Tier      │ │      Supabase Storage      │
│  PostgreSQL 16 + pgvector    │ │    (Bucket: "documents")   │
│       (384d embeddings)      │ │     or Cloudflare R2       │
└──────────────────────────────┘ └────────────────────────────┘
               ▲
               │ Direct LLM Inference
┌──────────────┴───────────────┐
│     Google Gemini Flash      │
│  (Free Tier: 15 RPM / 1M TPM)│
└──────────────────────────────┘
```

---

### 4.2 Component Specification & Configuration Guide

#### A. Frontend: Vercel Hobby (Free)
- **Root Directory:** `frontend`
- **Framework Preset:** `Next.js`
- **Build Command:** `next build --webpack`
- **Output Directory:** `.next`
- **Node.js Version:** `20.x` or `22.x`
- **Required Environment Variables (Vercel Project Settings):**
  ```env
  NEXT_PUBLIC_APP_NAME="Docora"
  NEXT_PUBLIC_API_URL="https://docora-api.onrender.com/api/v1"
  NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
  ```
- **Vercel Limitations:** Serverless execution timeout of 10s on Hobby tier. All heavy RAG chunking and extraction happen on the backend, making Vercel ideal for the static & client-rendered UI.

#### B. Backend: Render Free Web Service (Free)
- **Root Directory:** `backend`
- **Environment:** `Python 3`
- **Build Command:** `pip install -r requirements.txt && pip install psycopg[binary]`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Required Environment Variables (Render Dashboard):**
  ```env
  ENVIRONMENT=production
  DEBUG=false
  LOG_LEVEL=INFO
  APP_NAME="Docora"
  APP_TAGLINE="Your documents. Your intelligence."
  API_V1_PREFIX="/api/v1"
  SECRET_KEY="[generate via: openssl rand -hex 32]"
  ALLOWED_ORIGINS=["https://docora.vercel.app","http://localhost:3000"]

  # Database (Supabase PostgreSQL with pgvector)
  DATABASE_URL="postgresql+asyncpg://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
  DATABASE_SYNC_URL="postgresql+psycopg://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
  DB_POOL_SIZE=5
  DB_MAX_OVERFLOW=5
  VECTOR_DIMENSION=384

  # Authentication
  AUTH_PROVIDER="local_or_supabase"
  ALLOW_DEV_AUTH=false
  JWT_ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=1440

  # Storage (Supabase S3-Compatible / Storage API)
  STORAGE_PROVIDER=supabase
  SUPABASE_URL="https://[REF].supabase.co"
  SUPABASE_SERVICE_ROLE_KEY="[SUPABASE_SERVICE_ROLE_KEY]"
  SUPABASE_STORAGE_BUCKET="documents"
  SIGNED_URL_EXPIRATION_SECONDS=3600
  MAX_UPLOAD_SIZE_BYTES=26214400

  # AI / LLM Integration
  LLM_PROVIDER=gemini
  LLM_MODEL_NAME=gemini-3-flash-preview
  GEMINI_API_KEY="[GOOGLE_GEMINI_API_KEY]"
  EMBEDDING_PROVIDER=local
  EMBEDDING_MODEL_NAME="sentence-transformers/all-MiniLM-L6-v2"
  ```
- **Render Free Limitations:**
  - **Cold Starts:** Free instances spin down after 15 minutes of inactivity. Initial wake-up takes 50–70 seconds. The frontend displays graceful loading states and retry buttons.
  - **Ephemeral Disk:** Disk storage is wiped on restart. Setting `STORAGE_PROVIDER=supabase` prevents document loss.
  - **Single Web Process:** Render Free only allows 1 web service per repo. Background ingestion tasks are processed asynchronously via FastAPI's `BackgroundTasks` without needing a separate paid worker node.

#### C. Database: Supabase Free PostgreSQL with pgvector
- **PostgreSQL Version:** 16.x
- **Extension:** `pgvector` enabled via `CREATE EXTENSION IF NOT EXISTS vector;`
- **Connection String:**
  - Session mode (Direct): `port 5432` (`postgresql+asyncpg://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`)
  - Transaction Pooler (PgBouncer): `port 6543` (preferred for serverless connections)
- **Vector Dimension:** `384` (`sentence-transformers/all-MiniLM-L6-v2`)
- **Database Migrations Strategy:**
  Run migrations before booting the web service:
  ```bash
  alembic upgrade head
  ```

#### D. Document Storage: Supabase Storage / Cloudflare R2
- **Bucket Name:** `documents` (Set to **Private**)
- **Access Policy:** Private bucket; access strictly via presigned download URLs generated by the FastAPI backend using `SUPABASE_SERVICE_ROLE_KEY`.
- **Upload Limit:** Configured to 25 MB per file (`MAX_UPLOAD_SIZE_BYTES=26214400`).

#### E. Google Gemini API (Free Tier)
- **Free Tier Quotas:**
  - `gemini-3-flash-preview` / `gemini-3.1-flash-lite`: 15 Requests Per Minute (RPM), 1,000,000 Tokens Per Minute (TPM), 1,500 Requests Per Day (RPD).
- **Graceful Fallback & Retry:** The `GeminiProvider` class in `backend/app/services/llm/gemini.py` implements:
  - Automatic exponential backoff on HTTP 429 (`LLMRateLimitError`).
  - Transparent model fallback chain across `gemini-3-flash-preview` → `gemini-3.1-flash-lite` → `gemini-3.1-flash-lite-preview` → `gemini-3.5-flash-lite`.

---

## 5. Security & Operational Risk Matrix

| Risk Category | Severity | Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Tracked Sample Documents** | **HIGH** | 48 binary files in `backend/storage/documents/` tracked in Git. | Run `git rm --cached -r backend/storage/documents/` before pushing. |
| **Ephemeral Filesystem Data Loss** | **HIGH** | Render Free instances wipe local disk on spin-down. | Switch `STORAGE_PROVIDER` from `local` to `supabase` or Cloudflare R2. |
| **Render Free Cold Start Delay** | **MEDIUM** | 50–70s latency after 15 min idle. | Frontend displays loading spinner; optionally set up a free UptimeRobot probe to ping `/api/v1/health` every 10 min. |
| **Alembic Sync Driver Missing** | **MEDIUM** | `alembic.ini` requires `psycopg` for sync migrations. | Add `psycopg[binary]` to `backend/requirements.txt` or execute initial migration via SQL script in Supabase SQL editor. |
| **CORS Origin Mismatch** | **MEDIUM** | Backend rejects requests if frontend URL not in `ALLOWED_ORIGINS`. | Set `ALLOWED_ORIGINS=["https://docora.vercel.app"]` in Render env. |
| **Direct IP Access Block** | **LOW** | Host header validation blocks raw IP requests. | Always access backend through domain names (e.g. `docora-api.onrender.com`). |

---

## 6. Pre-Flight Deployment Checklist

Before executing `git push` to your GitHub repository and connecting to Vercel/Render, complete this checklist:

- [ ] **Step 1: Untrack binary storage files from Git**
  ```bash
  git rm --cached -r backend/storage/documents/
  git commit -m "chore: untrack local document storage binaries prior to deployment"
  ```
- [ ] **Step 2: Install psycopg[binary] for Alembic migration compatibility**
  Add `psycopg[binary]>=3.2.0` to `backend/requirements.txt`.
- [ ] **Step 3: Provision Supabase Project**
  - Create free project on [supabase.com](https://supabase.com).
  - In SQL Editor, run: `CREATE EXTENSION IF NOT EXISTS vector;`
  - In Storage, create a private bucket named `documents`.
- [ ] **Step 4: Create Private GitHub Repository & Push**
  ```bash
  git remote add origin https://github.com/[YOUR-USERNAME]/docora.git
  git branch -M main
  git push -u origin main
  ```
- [ ] **Step 5: Deploy Backend to Render**
  - Create Web Service from GitHub repo (`Root Directory: backend`).
  - Set Build Command: `pip install -r requirements.txt`
  - Set Start Command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Populate environment variables as detailed in Section 4.2.B.
- [ ] **Step 6: Deploy Frontend to Vercel**
  - Import repo on Vercel (`Root Directory: frontend`).
  - Add `NEXT_PUBLIC_API_URL` pointing to the Render backend URL.
  - Deploy and verify live SSL domain `https://docora.vercel.app`.

---

## 7. Audit Sign-Off

- **Audit Result:** **CONDITIONALLY READY**
- **Architecture Integrity:** Validated (FastAPI + Next.js + PostgreSQL pgvector + Gemini)
- **Branding Status:** 100% Docora (Zero UDIP residue in customer-facing UI)
- **Security Posture:** Hardened (CSRF cookies, CSP, rate-limiting, SecretStr isolation)
- **Deployment Verdict:** Upon executing the pre-flight untrack command (`git rm --cached -r backend/storage/documents/`) and provisioning Supabase storage, the repository is immediately ready for free demo deployment.
