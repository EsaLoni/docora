# DOCORA — PostgreSQL & pgvector Production Database Setup Guide

**Document Version:** 1.0.0
**Target Repository:** `C:\Users\esalo\Desktop\universal-document-intelligence`
**Application:** Docora (*Your documents. Your intelligence.*)
**Database Architecture:** Dual-Engine Architecture (Local SQLite Development + Production Supabase PostgreSQL with `pgvector`)

---

## 1. Existing Database Architecture Overview

Docora implements a dual-dialect database architecture using SQLAlchemy 2.0 and Alembic. The application is designed to run seamlessly across both lightweight local environments (SQLite) and enterprise production deployments (PostgreSQL + pgvector).

### Dual-Driver Separation

| Context | Driver / Protocol | Dialect Target | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Application Runtime (Async)** | `asyncpg` (`postgresql+asyncpg://`) | PostgreSQL 16+ | High-throughput, asynchronous web request handling, connection pooling, non-blocking I/O, native JSONB queries, and pgvector cosine distance search. |
| **Application Runtime (Async - Dev)** | `aiosqlite` (`sqlite+aiosqlite:///`) | SQLite 3 | Offline local development without external service dependencies. |
| **Alembic Migrations (Sync)** | `psycopg` (`postgresql+psycopg://`) | PostgreSQL 16+ | DDL schema creation, table migrations, HNSW index generation, extension loading, and transactional schema upgrades/rollbacks. |
| **Alembic Migrations (Sync - Dev)** | Standard SQLite (`sqlite:///`) | SQLite 3 | Local schema validation and migration testing. |

---

## 2. Configuration & Environment Variables

### 2.1 Connection String Normalization

The application configuration in `app.core.config.Settings` automatically adapts standard connection strings. If a developer provides a standard URL (such as `postgresql://...` or `postgres://...`), the application dynamically maps:
1. `DATABASE_URL` ➔ `postgresql+asyncpg://...` (for FastAPI async engine)
2. `DATABASE_SYNC_URL` ➔ `postgresql+psycopg://...` (for Alembic migrations)
3. `ALEMBIC_DATABASE_URL` (optional direct override for migration scripts)

### 2.2 Environment Variables Reference

| Variable Name | Environment | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Local Dev | `sqlite+aiosqlite:///storage/udip.db` | Local async SQLite database path. |
| `DATABASE_URL` | Production | `postgresql+asyncpg://postgres:[PW]@db.[REF].supabase.co:5432/postgres?ssl=require` | Async connection string used by FastAPI backend. |
| `DATABASE_SYNC_URL` | Local Dev | `sqlite:///storage/udip.db` | Synchronous DB URL used by Alembic locally. |
| `DATABASE_SYNC_URL` | Production | `postgresql+psycopg://postgres:[PW]@db.[REF].supabase.co:5432/postgres?sslmode=require` | Synchronous connection string for Alembic migrations. |
| `ALEMBIC_DATABASE_URL` | Production (Optional) | `postgresql+psycopg://postgres:[PW]@db.[REF].supabase.co:5432/postgres` | Explicit migration override (if different from app pooler). |
| `DB_POOL_SIZE` | Production | `5` (or `10`) | Base connection pool size. |
| `DB_MAX_OVERFLOW` | Production | `5` (or `10`) | Maximum burst connections beyond pool size. |
| `DB_POOL_TIMEOUT` | Production | `30` | Connection checkout timeout in seconds. |
| `DB_POOL_RECYCLE` | Production | `1800` | Connection recycling period (30 min) to avoid stale sockets. |
| `VECTOR_DIMENSION` | All | `384` | Embedding dimension (`sentence-transformers/all-MiniLM-L6-v2`). |

---

## 3. Supabase Connection & Pooling Recommendations

Supabase provides two connection modes. For Docora on free hosting tiers, observe the following guidelines:

### 3.1 Direct Connection (Port 5432) — Recommended for Migrations
- **Port:** `5432` (Session Mode)
- **Host:** `db.[PROJECT-REF].supabase.co`
- **Use Case:** Synchronous Alembic migrations (`DATABASE_SYNC_URL` / `ALEMBIC_DATABASE_URL`).
- **Reason:** DDL statements (such as `CREATE TABLE`, `CREATE INDEX`, `CREATE EXTENSION`) require session-level connection privileges.

### 3.2 Transaction Pooler (Port 6543) — Recommended for Application Web Service
- **Port:** `6543` (PgBouncer Mode)
- **Host:** `aws-0-[REGION].pooler.supabase.com`
- **Use Case:** Production FastAPI web service (`DATABASE_URL`).
- **Connection Parameters:** Add `?ssl=require` to enforce TLS.
- **Pool Sizing:** Set `DB_POOL_SIZE=5` and `DB_MAX_OVERFLOW=5` on Render Free tier to remain well within Supabase Free connection limits (60 connections total).

---

## 4. SSL & Security Requirements

1. **Enforced Encryption:** All remote connections to Supabase PostgreSQL require SSL. Append `?ssl=require` (for `asyncpg`) or `?sslmode=require` (for `psycopg`).
2. **Credential Masking:** Connection credentials must never be committed or logged. `app.core.config.Settings` masks all database passwords and tokens in application logging and public diagnostics.
3. **Tenant & Workspace Isolation:** All SQL queries and vector searches strictly filter on `workspace_id = :workspace_id` to prevent cross-tenant data leakage.

---

## 5. pgvector Extension & Vector Embeddings

Docora utilizes 384-dimensional dense vector embeddings generated by `sentence-transformers/all-MiniLM-L6-v2`.

### 5.1 Extension Activation Command
Prior to executing initial migrations on a new Supabase database, run the following SQL command in the Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
*(Note: Alembic Migration `20261113_0001_initial_schema.py` also checks and executes this statement automatically if connected as a PostgreSQL superuser/admin).*

### 5.2 Embedding Storage & HNSW Indexing
- **Table:** `document_chunks`
- **Column:** `embedding vector(384) NOT NULL`
- **Index:** Fast cosine similarity via Hierarchical Navigable Small World (HNSW) graphs:
  ```sql
  CREATE INDEX idx_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```
- **Fallback on SQLite:** In local SQLite mode, vector searches transparently fall back to an in-memory dot-product cosine similarity calculation using `numpy`, ensuring 100% test compatibility without requiring local PostgreSQL.

---

## 6. Migration Instructions

### 6.1 Executing Migrations in Production
On the deployment platform (e.g., Render start command or pre-deploy hook):
```bash
alembic upgrade head
```

### 6.2 Checking Migration Status
```bash
alembic current
alembic heads
```

### 6.3 Rollback Considerations
To roll back the most recent migration revision:
```bash
alembic downgrade -1
```
To roll back all migrations to base:
```bash
alembic downgrade base
```

---

## 7. Migration Revisions Inventory

The repository contains 5 verified, sequential Alembic migrations:

1. `20261113_0001_initial_schema.py`:
   - Creates 14 core tables (`users`, `workspaces`, `workspace_members`, `folders`, `documents`, `document_pages`, `document_chunks`, `processing_jobs`, `conversations`, `messages`, `citations`, `extractions`, `reminders`, `audit_logs`).
   - Configures `UUID(as_uuid=True)`, `JSONB`, and `Vector(384)`.
   - Creates the `idx_chunks_embedding_hnsw` HNSW index.
2. `20261113_0002_intelligence_models.py`:
   - Creates `document_summaries`, `document_comparisons`, `document_insights`, and `intelligence_jobs`.
3. `20261113_0003_actions_and_notifications.py`:
   - Creates `action_items`, `action_suggestions`, `notifications`, and `notification_deliveries`.
4. `20261114_0004_notebooks_and_studio.py`:
   - Creates `notebooks`, `notebook_sources`, `notebook_notes`, `studio_artifacts`, and `audio_generations`.
5. `20261115_0005_user_password_hash.py`:
   - Idempotently adds `password_hash` column to `users` for native email/password authentication.

---

## 8. Remaining Limitations & Production Notes

1. **Free Tier Cold Starts:** Render Free web service instances spin down after 15 minutes of inactivity. When waking up, database connection pools are freshly initialized using `pool_pre_ping=True` to discard any dead sockets gracefully.
2. **Local Development Untouched:** The existing SQLite file `storage/udip.db` remains 100% active, untouched, and functional for offline development.
3. **Supabase Pausing:** Supabase free-tier projects pause after 7 days of inactivity. If paused, restoring the project in the Supabase dashboard immediately restores all schemas, data, and vector tables.
