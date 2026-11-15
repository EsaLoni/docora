# PHASE 16 — DATABASE & PERSISTENCE AUDIT

**Project:** Universal Document Intelligence Platform (UDIP)
**Date:** 2026-11-15T16:55:00+05:30
**Lead Auditor:** Senior Database Architect & Backend Engineer
**Components:** `backend/app/core/database.py`, `backend/alembic/`, `backend/app/models/`

---

## 1. Database Tier Architecture

UDIP supports a dual database abstraction powered by SQLAlchemy 2.0 Async (`asyncpg` for PostgreSQL, `aiosqlite` for SQLite):

| Environment | Database Technology | Connection Pool Strategy | pgvector Support | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | SQLite 3 (`sqlite+aiosqlite:///...`) | `NullPool` | In-process Cosine Similarity | Lightweight local setup |
| **CI / Pytest Suite** | SQLite in-memory / file | `NullPool` (disposable) | In-process Cosine Similarity | Fast, fully isolated tests |
| **Production Target** | PostgreSQL 15+ (`postgresql+asyncpg://...`) | `QueuePool` (pool_size=10, max_overflow=20) | Native `pgvector` HNSW index | High concurrency, enterprise scale |

---

## 2. Connection Pooling & Transaction Management

In `backend/app/core/database.py`:
- **Pool Size:** `DB_POOL_SIZE` (default 10) with `DB_MAX_OVERFLOW` (default 20).
- **Recycle & Timeout:** `DB_POOL_RECYCLE = 1800s`, `DB_POOL_TIMEOUT = 30s`.
- **Pre-Ping:** `pool_pre_ping = True` enabled for PostgreSQL to immediately detect and evict dead connections before issuing queries.
- **Session Dependency:** `get_db_session()` FastAPI generator ensures isolated sessions with automatic `await session.commit()` on success and `await session.rollback()` on exception in a `try...finally` block.

---

## 3. Alembic Migration Lifecycle

The migration suite was audited for clean upgrade and downgrade capability:
- Head Migration: `20261115_0005_user_password_hash.py` (adds `password_hash` column to `users`).
- Verified in `test_alembic_migrations.py::test_alembic_migration_lifecycle`:
  - `alembic upgrade head` cleanly generates all 14 tables and indexes.
  - `alembic downgrade base` cleanly drops all tables in reverse foreign key order.
  - Zero migration drift or circular foreign-key constraints.

---

## 4. Multi-Tenant Partitioning & Indexing

All user-generated records (`Document`, `Notebook`, `Conversation`, `StudioArtifact`, `ActionItem`, `Reminder`, `AuditLog`) maintain mandatory `workspace_id` foreign keys indexed with composite indexes:
- `ix_documents_workspace_deleted` (`workspace_id`, `is_deleted`)
- `ix_chunks_document_index` (`document_id`, `chunk_index`)
- `ix_notebook_sources_notebook` (`notebook_id`, `is_active_for_queries`)
- `ix_studio_artifacts_notebook` (`notebook_id`, `artifact_type`)
- `ix_reminders_status_due` (`status`, `due_date`)

---

## 5. PostgreSQL vs SQLite Differences & Production Risks

1. **pgvector:** PostgreSQL leverages native C-extensions for cosine/inner-product similarity search (`vector <=> query_vector`). SQLite lacks vector extensions, falling back to Python-level numpy cosine similarity. Production deployments **must** run on PostgreSQL with the pgvector extension enabled.
2. **Concurrency (Write Locks):** SQLite locks the entire database file during writes (`database is locked` risk under concurrent user load). PostgreSQL supports row-level locking (MVCC) and is required for multi-user production.
