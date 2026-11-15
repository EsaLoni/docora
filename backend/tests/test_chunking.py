"""Unit and Integration Tests for UDIP Intelligent Chunking Engine.

Tests:
- RecursiveTextChunker (paragraph/sentence preservation, token limits, headings)
- TableAwareChunker (table row integrity, header repetition, mixed content)
- SemanticChunker (heading hierarchy grouping)
- ChunkingService (multi-page ordering, empty filtering, metadata persistence)
"""

import uuid
import pytest
from app.models.document import DocumentPage
from app.services.chunking.models import ChunkType, DocumentChunkResult
from app.services.chunking.recursive import RecursiveTextChunker
from app.services.chunking.table import TableAwareChunker
from app.services.chunking.semantic import SemanticChunker
from app.services.chunking.service import ChunkingService


def test_recursive_chunker_short_text():
    """Verify recursive chunker processes small text as a single chunk."""
    chunker = RecursiveTextChunker(chunk_size_tokens=512, chunk_overlap_tokens=64)
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    page_id = uuid.uuid4()
    text = "Universal Document Intelligence Platform delivers accurate retrieval."

    chunks = chunker.chunk_page(
        page_content=text,
        page_number=1,
        page_id=page_id,
        document_id=doc_id,
        workspace_id=ws_id,
    )

    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].page_number == 1
    assert chunks[0].page_id == page_id
    assert chunks[0].document_id == doc_id
    assert chunks[0].workspace_id == ws_id
    assert chunks[0].chunk_type == ChunkType.TEXT
    assert chunks[0].content == text
    assert chunks[0].token_count > 0


def test_recursive_chunker_paragraph_splitting():
    """Verify recursive chunker splits along paragraph boundaries when exceeding chunk size."""
    chunker = RecursiveTextChunker(chunk_size_tokens=30, chunk_overlap_tokens=5)
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    page_id = uuid.uuid4()

    p1 = "Paragraph 1: High performance AI document intelligence platform built with Python 3.13 and FastAPI."
    p2 = "Paragraph 2: PostgreSQL with pgvector extension stores 384-dimensional dense embeddings."
    p3 = "Paragraph 3: Low cost and open source first architecture designed for CPU-first execution."
    text = f"{p1}\n\n{p2}\n\n{p3}"

    chunks = chunker.chunk_page(
        page_content=text,
        page_number=2,
        page_id=page_id,
        document_id=doc_id,
        workspace_id=ws_id,
    )
    assert len(chunks) >= 2
    for i, c in enumerate(chunks):
        assert c.chunk_index == i
        assert c.page_number == 2
        assert len(c.content) > 0


def test_recursive_chunker_heading_extraction():
    """Verify recursive chunker extracts and tracks markdown section headings."""
    chunker = RecursiveTextChunker(chunk_size_tokens=50, chunk_overlap_tokens=5)
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    page_id = uuid.uuid4()

    text = (
        "# Executive Summary\n"
        "UDIP automates document intelligence for enterprise workloads.\n\n"
        "## Security Architecture\n"
        "Multi-tenant isolation ensures workspace separation across all database tables."
    )
    chunks = chunker.chunk_page(
        page_content=text,
        page_number=1,
        page_id=page_id,
        document_id=doc_id,
        workspace_id=ws_id,
    )
    assert len(chunks) >= 1
    headings = [c.section_title for c in chunks if c.section_title]
    assert any("Executive Summary" in h or "Security Architecture" in h for h in headings)


def test_table_aware_chunker_row_integrity():
    """Verify table aware chunker keeps table rows intact and repeats headers."""
    chunker = TableAwareChunker(chunk_size_tokens=40, chunk_overlap_tokens=5)
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    page_id = uuid.uuid4()

    header = "| Metric | Target | Actual |"
    sep = "|---|---|---|"
    rows = [f"| Row {i} | Target {i} | Actual {i} |" for i in range(1, 15)]
    table_text = "\n".join([header, sep] + rows)

    chunks = chunker.chunk_page(
        page_content=table_text,
        page_number=3,
        page_id=page_id,
        document_id=doc_id,
        workspace_id=ws_id,
    )
    assert len(chunks) > 1

    # Each chunk should contain a table structure with headers
    for c in chunks:
        assert c.chunk_type == ChunkType.TABLE
        assert "| Metric | Target | Actual |" in c.content


def test_semantic_chunker_grouping():
    """Verify semantic chunker partitions along heading sections."""
    chunker = SemanticChunker(chunk_size_tokens=60, chunk_overlap_tokens=5)
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    page_id = uuid.uuid4()

    text = (
        "## Section A: Overview\n"
        "This section describes the overview of the system.\n\n"
        "## Section B: Database\n"
        "PostgreSQL 16 with pgvector extension handles dense embeddings.\n\n"
        "## Section C: Retrieval\n"
        "Hybrid search combines vector search and full text keyword retrieval."
    )
    chunks = chunker.chunk_page(
        page_content=text,
        page_number=4,
        page_id=page_id,
        document_id=doc_id,
        workspace_id=ws_id,
    )
    assert len(chunks) >= 2
    sections = [c.section_title for c in chunks if c.section_title]
    assert len(sections) >= 2


def test_chunking_service_orchestration():
    """Verify ChunkingService processes multi-page extracted documents monotonically."""
    service = ChunkingService()
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    pages = [
        DocumentPage(
            id=uuid.uuid4(),
            document_id=doc_id,
            page_number=1,
            content="# Introduction\nUDIP is a secure document intelligence platform.",
            token_count=15,
        ),
        DocumentPage(
            id=uuid.uuid4(),
            document_id=doc_id,
            page_number=2,
            content="",  # Empty page should be skipped safely
            token_count=0,
        ),
        DocumentPage(
            id=uuid.uuid4(),
            document_id=doc_id,
            page_number=3,
            content="| Col A | Col B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |",
            token_count=20,
        ),
    ]

    chunks = service.chunk_document_pages(pages, workspace_id=ws_id, document_id=doc_id)
    assert len(chunks) >= 2

    # Verify monotonic 0-based indexing
    for i, chunk in enumerate(chunks):
        assert chunk.chunk_index == i
        assert chunk.page_number in (1, 3)
        assert len(chunk.content.strip()) > 0
        assert chunk.workspace_id == ws_id
        assert chunk.document_id == doc_id
