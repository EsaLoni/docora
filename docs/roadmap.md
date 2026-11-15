# UDIP Master Implementation Roadmap

This document outlines the structured 10-phase execution plan for the **Universal Document Intelligence Platform (UDIP)**. Development follows strict gate criteria: each phase must be planned, implemented, tested, and verified before proceeding to subsequent phases.

---

## Phase Overview

```mermaid
flowchart LR
    P1["Phase 1: Environment & Architecture"] --> P2["Phase 2: Repository Foundation"]
    P2 --> P3["Phase 3: Database & Auth"]
    P3 --> P4["Phase 4: Document Upload & Mgmt"]
    P4 --> P5["Phase 5: Extraction & OCR"]
    P5 --> P6["Phase 6: Chunking & Vectors"]
    P6 --> P7["Phase 7: AI Chat & Citations"]
    P7 --> P8["Phase 8: Comparison & Extractions"]
    P8 --> P9["Phase 9: Analytics & Exports"]
    P9 --> P10["Phase 10: Security & Deploy"]
```

---

## Detailed Phase Breakdown

### Phase 1: Environment Inspection and Architecture *(Current Phase)*
- **Objective**: Inspect host environment, assess resource limitations (8GB RAM, CPU-first), define clean architecture, write complete technical specifications and foundation configurations.
- **Key Deliverables**:
  - Host environment audit (Python, Node.js, Git, RAM, CPU).
  - Clean modular monolith architecture design (`docs/architecture.md`).
  - Third Normal Form (3NF) database schema with pgvector (`docs/database.md`).
  - Security and threat mitigation specification (`docs/security.md`).
  - Implementation roadmap (`docs/roadmap.md`) and development checklist (`docs/development_checklist.md`).
  - Secure `.gitignore`, comprehensive `.env.example`, and `docker-compose.yml`.
- **Exit Criteria**: All architectural documentation complete, reviewed, and approved.

---

### Phase 2: Repository and Project Foundation
- **Objective**: Establish the foundational codebase for both Backend (FastAPI) and Frontend (Next.js).
- **Key Deliverables**:
  - **Backend**:
    - `pyproject.toml` and `requirements.txt` with locked dependencies.
    - Core configuration module (`app/core/config.py`) using Pydantic Settings.
    - Centralized structured logging and error handling middleware.
    - FastAPI application entrypoint (`app/main.py`) with `/api/v1/health` endpoint.
    - Initial Pytest setup and health check tests.
  - **Frontend**:
    - Next.js App Router initialization with TypeScript and Tailwind CSS.
    - shadcn/ui components setup and Lucide icons.
    - Base layout, responsive navigation shell, and theme provider.
- **Exit Criteria**: Backend health test passes (`pytest backend/tests/test_api_health.py`), Frontend compiles and renders without errors.

---

### Phase 3: Database and Authentication
- **Objective**: Implement normalized SQLAlchemy models, Alembic migrations, pgvector support, and multi-tenant authentication.
- **Key Deliverables**:
  - SQLAlchemy 2.0 ORM models for all 13+ tables.
  - Alembic migration scripts initializing tables, HNSW indexes, and GIN search vectors.
  - Pluggable authentication service: Supabase Auth integration with local JWT fallback for offline dev.
  - Workspace authorization middleware ensuring workspace-scoped access control.
  - Unit and integration tests for database models and auth flow.
- **Exit Criteria**: Alembic migration executes cleanly; test suite passes for workspace isolation and auth token validation.

---

### Phase 4: Document Upload and Management
- **Objective**: Implement secure multi-format document upload, storage abstraction, metadata indexing, and folder management.
- **Key Deliverables**:
  - Pluggable storage adapter (`LocalDiskStorage` and `SupabaseStorage`).
  - Multi-stage upload validation (MIME detection, magic byte verification, file size enforcement).
  - Document repository and REST endpoints:
    - `POST /api/v1/documents/upload`
    - `GET /api/v1/documents`
    - `GET /api/v1/documents/{id}`
    - `DELETE /api/v1/documents/{id}` (complete physical and relational purge).
  - Folder creation, nesting, and tag assignment endpoints.
  - Frontend Document Library UI with upload dropzone, folder hierarchy, and status badges.
- **Exit Criteria**: Uploading valid and invalid files triggers appropriate success/rejection responses; physical files and database records synchronize accurately.

---

### Phase 5: Document Extraction and OCR
- **Objective**: Implement page-aware content extraction for all supported formats with OCR fallback.
- **Key Deliverables**:
  - Modular extraction engine with format-specific extractors:
    - `PDFExtractor` (PyMuPDF / fitz) preserving canonical page numbers and image metadata.
    - `DOCXExtractor` (python-docx) extracting headings, paragraphs, and tables.
    - `SpreadsheetExtractor` (openpyxl, pandas) converting sheets to markdown/CSV tables.
    - `PresentationExtractor` (python-pptx) extracting slide-by-slide text and speaker notes.
    - `TextExtractor` (UTF-8 stream parsing).
    - `OCRExtractor` (Pillow + Tesseract OCR) with graceful fallback when Tesseract binary is absent.
  - Population of `document_pages` table with page-level text and token counts.
  - Asynchronous worker background processing pipeline with retry handling.
- **Exit Criteria**: Sample files for all formats extract accurately with correct page numbering; unit tests verify extractors.

---

### Phase 6: Chunking, Embeddings and Vector Search
- **Objective**: Implement semantic chunking, CPU-optimized embedding generation, and hybrid pgvector retrieval.
- **Key Deliverables**:
  - Page-aware semantic chunker (300-500 tokens with 50-token sliding overlap).
  - Embedding pipeline using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, CPU optimized).
  - Storage in `document_chunks` table with pgvector HNSW index.
  - Hybrid retrieval engine:
    - Dense vector cosine similarity.
    - Sparse PostgreSQL full-text search (`tsvector` + GIN).
    - Reciprocal Rank Fusion (RRF) ranking algorithm.
  - Search API endpoints with workspace and document filtering.
- **Exit Criteria**: Chunks are properly generated with embeddings; vector similarity and hybrid search return top-K relevant chunks with low latency on CPU.

---

### Phase 7: AI Chat and Citations
- **Objective**: Build conversational RAG with strict page-level citation verification and abstention safeguards.
- **Key Deliverables**:
  - Pluggable LLM interface (`MockHeuristicProvider`, `OllamaProvider`, `OpenAICompatibleProvider`, `GeminiProvider`).
  - Context assembly with strict prompt injection guardrails (`<document_context>` XML encapsulation).
  - Citation verification engine validating chunk IDs, quotes, and actual page numbers.
  - Conversational REST endpoints:
    - `POST /api/v1/conversations`
    - `POST /api/v1/conversations/{id}/messages` (streaming & non-streaming)
  - Frontend AI Chat Workspace UI: multi-turn chat, interactive citation popovers, side-by-side document preview linked to cited page.
- **Exit Criteria**: Assistant generates accurate responses with verified page citations; test verifies refusal to hallucinate citations or execute injected instructions.

---

### Phase 8: Comparison and Structured Extraction
- **Objective**: Implement structured schema-driven data extraction and cross-document comparison.
- **Key Deliverables**:
  - Schema-guided extraction engine (invoices, contracts, financial tables) storing output in `extractions` table.
  - Document comparison engine: side-by-side semantic diffing, clause comparison, and discrepancy identification.
  - Comparison API endpoints and Frontend Comparison Matrix UI.
  - Date & obligation extraction engine populating `reminders` table with user-confirmation workflows.
- **Exit Criteria**: Structured extraction conforms to Pydantic schemas; comparison correctly flags additions, omissions, and discrepancies between document versions.

---

### Phase 9: Analytics and Exports
- **Objective**: Provide comprehensive document analytics and multi-format reporting exports.
- **Key Deliverables**:
  - Analytics service aggregating token usage, document types, page counts, query frequencies.
  - PDF export engine generating structured briefing reports and chat transcripts.
  - Excel/CSV export engine exporting structured extraction tables and comparison matrices.
  - Frontend Analytics Dashboard with visual charts, metrics cards, and export triggers.
- **Exit Criteria**: Exported PDF and Excel files generate cleanly and match source data; analytics queries execute efficiently.

---

### Phase 10: Security, Testing and Deployment
- **Objective**: Conduct rigorous end-to-end security audits, automated testing, containerized packaging, and release documentation.
- **Key Deliverables**:
  - Comprehensive test suite: Pytest unit & integration tests, Playwright frontend tests.
  - Security hardening: rate limiting (Slowapi), CORS policies, header security (CSP, HSTS), sanitized audit logging.
  - Docker Compose production configuration with resource limits (RAM caps).
  - Comprehensive User Manual and Deployment Guide.
- **Exit Criteria**: 100% test pass rate across unit, integration, and security test suites; clean deployment verification.
