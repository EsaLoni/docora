# Docora

> **"Your documents. Your intelligence."**

**Docora** is a production-ready, AI-powered document intelligence and research workspace. Docora empowers users to upload complex documents, organize them in private personal workspaces, search contents using hybrid semantic and keyword retrieval, converse with single or multiple documents with verified citations, extract structured data, compare files, and generate AI-powered learning and studio artifacts including mind maps, audio overviews, video storyboards, flashcards, quizzes, data tables, and executive reports.

---

## 1. Product Overview

Docora is built as a complete document intelligence and research operating system with:
- **Private Personal Workspaces & Folders**: Strict workspace isolation, hierarchical folders, and metadata tagging.
- **Multi-Format Document Ingestion**: Native extraction for PDF, DOCX, XLSX, CSV, PPTX, TXT, and scanned image formats.
- **Page-Aware Processing & Citations**: Preserves page numbers, table structures, and bounding identifiers throughout the ingestion pipeline.
- **Hybrid RAG Retrieval**: Combines pgvector cosine similarity (384-dimensional embeddings via `all-MiniLM-L6-v2`) and PostgreSQL keyword/trigram search with reciprocal rank fusion (RRF).
- **Strict Evidence-Based Answers**: Enforces citation verification, rejecting hallucinated page numbers and abstaining when source evidence is insufficient.
- **Deep Intelligence Modules**: Automated document summarization, schema-driven structured entity extraction, cross-document comparison with semantic diffing, and date/event extraction with reminder prompts.
- **Action Management & Document-Driven Automation**: Automated suggestion extraction from contracts, invoices, and reports; user-approved action item tracking; flexible reminder scheduler with in-app notifications.
- **Hardened Production Architecture**: Multi-stage rate limiting, correlation IDs (`X-Request-ID`), structured JSON logging, health probes (`/health`, `/health/live`, `/health/ready`), Prometheus metrics exposition (`/metrics`), ZIP bomb protection, and heuristic malware scanning.

---

## 2. Technical Stack & Environmental Constraints

Docora is architected specifically for **CPU-first execution on resource-constrained hardware (8 GB RAM)**, prioritizing lightweight, cost-effective, and open-source components.

| Component | Technology | Rationale / Constraints |
|---|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide Icons | High-performance, accessible, standalone container bundle |
| **Backend API** | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic | Async I/O, clean architecture, typed REST APIs under `/api/v1` |
| **Database & Vectors** | PostgreSQL 16 + pgvector | Native vector storage (384-dim), HNSW indexing, full relational modeling |
| **Authentication** | Supabase Auth + Strict JWT validation | Cryptographic verification (HS256), audience/issuer checks |
| **Object Storage** | Private Supabase Storage + Local disk storage adapter | Pluggable storage with signed URLs, quotas, and path sanitization |
| **Document Processing** | PyMuPDF, python-docx, openpyxl, python-pptx, pandas, Pillow, Tesseract OCR | Native format handling with page-level text extraction and fallback OCR |
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` | Ultra-compact (~80MB model, 384 dimensions), low CPU memory footprint (~200MB RAM) |
| **LLM Engine** | Pluggable: Ollama (local), OpenAI-compatible APIs, Google Gemini, or Built-in Heuristic Mock | Zero-cost development mode, scalable to production LLM backends |
| **Testing** | Pytest, pytest-asyncio, HTTPX | Comprehensive unit, security, and benchmark test suites |
| **Infrastructure** | Docker, Docker Compose, Nginx, GitHub Actions CI/CD | Production-grade containerization with resource limits for 8 GB RAM |

---

## 3. Architecture & Repository Structure

```
universal-document-intelligence/
├── backend/
│   ├── alembic/            # Database schema migrations (0001, 0002, 0003)
│   ├── app/
│   │   ├── api/            # FastAPI routers (documents, chat, intelligence, actions, health)
│   │   ├── core/           # Config, database engine, security, logging, metrics, rate limiting
│   │   ├── models/         # SQLAlchemy 2.0 ORM normalized models
│   │   └── services/       # Ingestion, storage, chunking, retrieval, RAG, worker runner
│   ├── tests/              # 160+ automated unit, integration, and security tests
│   ├── Dockerfile          # Multi-stage Python 3.13-slim production image
│   ├── requirements.txt    # Pinned production Python dependencies
│   └── pyproject.toml      # Project metadata and tooling config
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router (Dashboard, Documents, Chat, Intelligence, Actions, Reminders)
│   │   ├── components/     # UI primitives, error boundaries, navigation
│   │   └── lib/            # API client and utility functions
│   ├── Dockerfile          # Multi-stage Next.js 16 standalone production image
│   └── package.json        # Frontend dependencies
├── nginx/
│   └── nginx.conf          # Reverse proxy, SSL, Gzip, SSE buffering, security headers
├── docs/                   # Architectural & technical documentation
│   ├── architecture.md     # Deep architecture, data flow, and CPU optimization
│   ├── database.md         # Full normalized database schema & vector indexing
│   ├── deployment.md       # Step-by-step production deployment guide
│   ├── backup_and_recovery.md # Automated backups, PITR, and migration rollback
│   ├── operations_runbook.md  # Day-2 runbook, alerting, and incident response
│   └── PHASE_*_COMPLETION_REPORT.md # Historical milestone verification reports
├── docker-compose.yml      # Local development multi-container stack
├── docker-compose.prod.yml # Production multi-container stack with Nginx & resource limits
├── .env.production.example # Production environment template
├── SECURITY.md             # Security architecture & vulnerability disclosure policy
└── README.md               # Project guide and overview
```

---

## 4. Quick Start

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/universal-document-intelligence.git
cd universal-document-intelligence

# 2. Start PostgreSQL with pgvector
docker compose up -d postgres

# 3. Backend Setup
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Frontend Setup (in a separate terminal)
cd ../frontend
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## 5. Production Deployment (Docker Compose)

Deploy the entire stack with reverse proxy, SSL, and resource limits:

```bash
# 1. Configure production environment
cp .env.production.example .env.production
# Edit .env.production with your secure secrets

# 2. Build and launch production stack
docker compose -f docker-compose.prod.yml up -d --build

# 3. Apply schema migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 4. Verify system readiness
curl -f http://localhost/health/ready
```

See [docs/deployment.md](file:///c:/Users/esalo/Desktop/universal-document-intelligence/docs/deployment.md) for full deployment instructions and [docs/backup_and_recovery.md](file:///c:/Users/esalo/Desktop/universal-document-intelligence/docs/backup_and_recovery.md) for disaster recovery.

---

## 6. Testing & Quality Assurance

Run the comprehensive automated test suite:

```bash
# Backend test suite (160+ tests including security & benchmarks)
cd backend
pytest tests -v

# Frontend standalone production build
cd ../frontend
npm run build
```

---

## 7. Security Policy

For security architecture, threat models, and vulnerability reporting instructions, please review [SECURITY.md](file:///c:/Users/esalo/Desktop/universal-document-intelligence/SECURITY.md).
