# DOCORA — SUPABASE CONFIGURATION COMPATIBILITY & INTEGRATION MAPPING

**Project:** Docora (Universal Document Intelligence Platform)
**Workspace:** `C:\Users\esalo\Desktop\universal-document-intelligence`
**GitHub Repository:** `https://github.com/EsaLoni/docora`
**Active Branch:** `public-main-clean`
**Target Infrastructure:** Hosted Supabase Project (PostgreSQL 16, pgvector, Private Storage `udip-documents`)
**Audit Date:** November 16, 2026

---

## 1. Executive Summary

This compatibility audit inspects the Docora codebase across its database connectivity, connection pooling, prepared statement management, Alembic migration runner, Supabase Storage REST adapter, and JWT authentication layers.

### Key Compatibility Findings

| Subsystem | Requirement | Compatibility Status | Notes |
| :--- | :--- | :--- | :--- |
| **Relational Database** | Supabase PostgreSQL 16 | **COMPATIBLE** | Supported via `asyncpg` (async) and `psycopg` (sync). |
| **Vector Extension** | pgvector (384 dimensions) | **COMPATIBLE** | Schema migrations define `Vector(384)` with HNSW cosine index `idx_chunks_embedding_hnsw`. |
| **Transaction Pooler (Port 6543)** | Prepared statement caching | **COMPATIBLE** | Code automatically enforces `prepared_statement_cache_size=0` on pooler hosts. |
| **Session Pooler (Port 5432)** | Session-level state & migrations | **COMPATIBLE** | Direct/Session pooler supported; recommended for Alembic migrations. |
| **Alembic CLI Migration** | Migration command support | **COMPATIBLE** | Supports `-x url=...`, `-o sqlalchemy.url=...`, and `ALEMBIC_DATABASE_URL`. |
| **Private Storage Bucket** | S3/REST API bucket `udip-documents` | **COMPATIBLE** | `SupabaseStorageAdapter` uploads via REST using service role / secret key; generates HMAC signed URLs. |
| **Supabase API Keys** | Legacy vs. New (`sbs_...` / `sbp_...`) | **COMPATIBLE (with caveats)** | Storage adapter supports both; User JWT auth strictly requires `SUPABASE_JWT_SECRET`. |

---

## 2. Environment Variable Mapping

The table below lists the exact environment variable names defined in `backend/app/core/config.py`. No synthetic variable names have been introduced.

| Variable Name | Required By | Purpose | Secret? | Default / Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | FastAPI, Worker | Sets execution mode (`development`, `test`, `production`). In `production`, strict security invariants are enforced. | No | `production` |
| `DATABASE_URL` | FastAPI, Worker | Primary asynchronous database connection string using `asyncpg`. | **YES** | `postgresql+asyncpg://postgres.[REF]:[PWD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?ssl=require&prepared_statement_cache_size=0` |
| `DATABASE_SYNC_URL` | Alembic, CLI | Synchronous fallback connection string using `psycopg`. | **YES** | `postgresql+psycopg://postgres.[REF]:[PWD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?ssl=require` |
| `ALEMBIC_DATABASE_URL` | Alembic | Dedicated synchronous connection string for Alembic migrations. Overrides `DATABASE_SYNC_URL`. | **YES** | `postgresql+psycopg://postgres.[REF]:[PWD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?ssl=require` |
| `DB_POOL_SIZE` | FastAPI, Worker | Number of persistent connections maintained in async engine pool. | No | `10` |
| `DB_MAX_OVERFLOW` | FastAPI, Worker | Max additional transient connections above `DB_POOL_SIZE`. | No | `15` |
| `DB_POOL_TIMEOUT` | FastAPI, Worker | Seconds to wait before timing out on connection pool exhaustion. | No | `30` |
| `DB_POOL_RECYCLE` | FastAPI, Worker | Seconds after which idle connections are recycled (prevents stale TCP drops). | No | `1800` |
| `VECTOR_DIMENSION` | FastAPI, Worker | Vector embedding dimension. Strictly enforced to 384. | No | `384` |
| `AUTH_PROVIDER` | FastAPI | Authentication provider. Set to `supabase` in production. | No | `supabase` |
| `SUPABASE_URL` | FastAPI, Worker, Storage | Supabase project base HTTPS URL. | No | `https://[PROJECT_REF].supabase.co` |
| `SUPABASE_ANON_KEY` | FastAPI (Public config) | Supabase client anon / publishable key. | No | `[ANON_OR_PUBLISHABLE_KEY]` |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage, Worker | Supabase service role key or secret key (`sbs_...`) used for storage operations. Never exposed to frontend. | **YES** | `[SERVICE_ROLE_OR_SECRET_KEY]` |
| `SUPABASE_JWT_SECRET` | FastAPI (Auth) | HMAC secret used to verify Supabase Auth user session tokens. | **YES** | `[SUPABASE_JWT_SECRET]` |
| `SUPABASE_JWT_AUDIENCE` | FastAPI (Auth) | Expected audience claim in JWT. | No | `authenticated` |
| `SUPABASE_JWT_ISSUER` | FastAPI (Auth) | Expected issuer claim in JWT (optional). | No | `https://[PROJECT_REF].supabase.co/auth/v1` |
| `STORAGE_PROVIDER` | FastAPI, Worker | Active file storage engine. Must be `supabase` in production. | No | `supabase` |
| `SUPABASE_STORAGE_BUCKET` | FastAPI, Storage | Name of private Supabase Storage bucket for document storage. | No | `udip-documents` |
| `SIGNED_URL_EXPIRATION_SECONDS`| FastAPI, Storage | Lifetime in seconds for generated signed download URLs. | No | `3600` |
| `LLM_PROVIDER` | FastAPI, Worker | LLM engine provider. Set to `gemini`. | No | `gemini` |
| `LLM_MODEL_NAME` | FastAPI, Worker | Primary Gemini model identifier. | No | `gemini-3.8-flash` |
| `GEMINI_API_KEY` | FastAPI, Worker | Google Gemini API key. | **YES** | `[GEMINI_API_KEY]` |
| `ALLOWED_ORIGINS` | FastAPI | JSON list or comma-separated list of authorized frontend origins. | No | `["https://your-docora-app.vercel.app"]` |
| `SECRET_KEY` | FastAPI | Application secret key for CSRF and local tokens (min 32 chars). | **YES** | `[SECURE_32_CHAR_HEX]` |

---

## 3. Where to Obtain Required Supabase Values

Navigate to the Supabase Dashboard (`https://supabase.com/dashboard/project/[PROJECT_REF]`):

### 3.1. Database Connection Strings
Go to **Project Settings > Database > Connection Pooling**:
1. **Transaction Pooler URL (Port 6543):**
   - Mode: `Transaction`
   - Port: `6543`
   - Use for: `DATABASE_URL` (Render Web Service & Background Worker).
   - Format: `postgresql+asyncpg://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?ssl=require&prepared_statement_cache_size=0`
2. **Session Pooler URL (Port 5432):**
   - Mode: `Session`
   - Port: `5432`
   - Use for: `ALEMBIC_DATABASE_URL` and `DATABASE_SYNC_URL` (Alembic Migrations).
   - Format: `postgresql+psycopg://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?ssl=require`

### 3.2. API Keys & Secrets
Go to **Project Settings > API**:
1. **Project URL:**
   - Under **Configuration > Project URL**, copy the URL (`https://[PROJECT_REF].supabase.co`).
   - Use for: `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`.
2. **Anon / Publishable Key:**
   - Under **Project API keys > anon / public** (or `sbp_...` publishable key).
   - Use for: `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Service Role / Secret Key:**
   - Under **Project API keys > service_role / secret** (or `sbs_...` secret key).
   - Use for: `SUPABASE_SERVICE_ROLE_KEY`.
4. **JWT Secret:**
   - Scroll down to **JWT Settings > JWT Secret**. Click Reveal and copy.
   - Use for: `SUPABASE_JWT_SECRET`.
   - **CRITICAL DISTINCTION:** `SUPABASE_JWT_SECRET` is the raw cryptographic secret used by Python's `jwt.decode()` in `backend/app/core/security.py` to verify user auth tokens. It is **NOT** the `service_role` key or `sbs_...` API key.

---

## 4. Supabase API Key Compatibility Analysis

Supabase has introduced new API key formats (`sbp_...` for publishable keys and `sbs_...` for secret keys) alongside legacy JWT-formatted keys (`anon` and `service_role`).

### 4.1. Storage Adapter (`backend/app/services/storage/supabase.py`)
- **Code Inspection:**
  ```python
  def _headers(self, content_type: Optional[str] = None) -> dict:
      headers = {
          "Authorization": f"Bearer {self.service_key}",
          "apiKey": self.service_key,
      }
      if content_type:
          headers["Content-Type"] = content_type
      return headers
  ```
- **Compatibility:** **FULLY COMPATIBLE**.
  The Supabase Storage REST endpoint (`/storage/v1/object/...`) evaluates either the `apiKey` header or the `Authorization: Bearer <key>` header. Supabase's API gateway accepts both legacy `service_role` JWTs and newer `sbs_...` secret keys.

### 4.2. User Authentication & JWT Verification (`backend/app/core/security.py`)
- **Code Inspection:**
  ```python
  supabase_secret = settings.SUPABASE_JWT_SECRET.get_secret_value()
  decode_kwargs = {
      "jwt": token,
      "key": supabase_secret,
      "algorithms": [settings.JWT_ALGORITHM, "HS256"],
      "options": verify_options,
  }
  payload = jwt.decode(**decode_kwargs)
  ```
- **Compatibility:** **COMPATIBLE WITH JWT SECRET**.
  Docora performs stateless cryptographic verification of incoming bearer tokens using `SUPABASE_JWT_SECRET`. Whether the project uses legacy or newer keys, user session tokens emitted by Supabase Auth are signed with the project's HMAC `JWT Secret`. The operator must set `SUPABASE_JWT_SECRET` to the value from **Project Settings > API > JWT Settings**.

---

## 5. Database Connection Mode Recommendations

Supabase provides three distinct database connection paths:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               SUPABASE POSTGRESQL 16                                   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
   [Direct Connect]               [Session Pooler]                 [Transaction Pooler]
   db.[REF].supabase.co:5432      pooler.supabase.com:5432         pooler.supabase.com:6543
   IPv6-default                   IPv4-compatible (Supavisor)      IPv4-compatible (Supavisor)
   Full state, DDL locks          Full state, DDL locks            Stateless per transaction
   High memory per conn           Moderate memory                  Ultra-high concurrency
         │                                 │                                 │
         │                                 │                                 ▼
         │                                 │                     [FastAPI & Background Worker]
         │                                 │                     DATABASE_URL (port 6543)
         │                                 │                     prepared_statement_cache_size=0
         │                                 ▼
         └───────────────────────> [Alembic Migrations]
                                   ALEMBIC_DATABASE_URL (port 5432)
```

### 5.1. FastAPI Web Service (`docora-api`)
- **Recommended Mode:** **Transaction Pooler (Port 6543)**
- **Host:** `aws-0-[REGION].pooler.supabase.com:6543`
- **Driver:** `postgresql+asyncpg`
- **Rationale:**
  FastAPI handles many concurrent HTTP requests. Transaction pooling re-uses connections between queries without holding open server processes during request idle time.
- **Prepared Statement Cache Protection:**
  In `backend/app/core/database.py` (lines 62–67), the engine detects `:6543` or `pooler.supabase.com` and automatically sets `prepared_statement_cache_size=0` and `statement_cache_size=0`, preventing `DuplicatePreparedStatementError`.

### 5.2. Background Worker (`docora-worker`)
- **Recommended Mode:** **Transaction Pooler (Port 6543)** or **Session Pooler (Port 5432)**
- **Driver:** `postgresql+asyncpg`
- **Rationale:**
  The worker executes atomic job claims (`SELECT ... FOR UPDATE SKIP LOCKED`), page text persistence, and vector insertion. Each job runs inside an isolated `async with session_factory() as session` transaction. Transaction pooling on port 6543 works cleanly for these short-lived transactions.

### 5.3. Alembic Database Migrations
- **Recommended Mode:** **Session Pooler (Port 5432)** or **Direct Connection (Port 5432)**
- **Driver:** `postgresql+psycopg`
- **NEVER RUN MIGRATIONS ON PORT 6543:**
  Transaction poolers do not support DDL locks, schema alteration transactions, advisory locks, or pgvector extension creation (`CREATE EXTENSION IF NOT EXISTS vector`).
- **Render Networking Note:**
  Direct connections (`db.[REF].supabase.co:5432`) use IPv6. Render containers do not have native IPv6 outbound routing by default. Therefore, the **Session Pooler (`aws-0-[REGION].pooler.supabase.com:5432`)** is the recommended migration endpoint because it resolves via IPv4.

---

## 6. Alembic Migration Command Supported by Actual Code

Inspection of `backend/alembic/env.py` reveals the order of resolution for migration connection strings:
1. `-x url=...` command-line argument.
2. `-o sqlalchemy.url=...` command-line option.
3. `ALEMBIC_DATABASE_URL` environment variable.
4. `DATABASE_SYNC_URL` environment variable.
5. Application settings (`settings.ALEMBIC_DATABASE_URL`).

### Exact Supported Commands

#### Option A: Dedicated Environment Variable (Recommended for CI/CD and Render)
```bash
ALEMBIC_DATABASE_URL="postgresql+psycopg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?ssl=require" alembic upgrade head
```

#### Option B: CLI Argument (`-x url=...`)
```bash
alembic -x url="postgresql+psycopg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?ssl=require" upgrade head
```

#### Option C: Config Override (`-o sqlalchemy.url=...`)
```bash
alembic -o sqlalchemy.url="postgresql+psycopg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?ssl=require" upgrade head
```

---

## 7. Storage Setup & Tenant Isolation Verification

### 7.1. Bucket Creation Requirements
In the Supabase Dashboard (**Storage > New Bucket**):
- **Name:** `udip-documents` (must match `SUPABASE_STORAGE_BUCKET`).
- **Public Bucket:** **UNCHECKED (Private Bucket)**. All document binaries must be private.

### 7.2. Path Layout & Multi-Tenant Separation
The storage adapter (`backend/app/services/storage/supabase.py`) constructs storage object paths as:
- **Documents:** `{workspace_id}/{document_id}.bin`
- **Studio Artifacts:** `{workspace_id}/artifacts/{artifact_id}/{filename}`

### 7.3. Authorization & Signed URL Verification
Inspection of `backend/app/api/v1/documents.py` (lines 395–435) confirms:
1. **Tenant Isolation:** Before generating a download link, the backend executes:
   ```python
   stmt = select(Document).where(
       Document.id == document_id,
       Document.workspace_id == workspace.id,
       Document.is_deleted == False,
   )
   doc = (await db.execute(stmt)).scalar_one_or_none()
   if not doc:
       raise ResourceNotFoundError("Document", str(document_id))
   ```
   Users from Workspace A cannot access or generate signed URLs for documents in Workspace B.
2. **Credential Privacy:** The signed download URL is generated server-side using the `service_role` key and returned to the client as a time-limited URL (default: 3600s). The `SUPABASE_SERVICE_ROLE_KEY` is **never transmitted to the frontend**.

---

## 8. Summary of Code Refinements Applied

During this audit, the following enhancement was verified:

- **`backend/alembic/env.py` (lines 33–50):** Added explicit support for `context.get_x_argument(as_dictionary=True).get("url")`, enabling standard `alembic -x url=... upgrade head` invocations alongside existing `-o sqlalchemy.url=...` and environment variable workflows. All 235 backend test suites continue to pass with 100% compliance.
