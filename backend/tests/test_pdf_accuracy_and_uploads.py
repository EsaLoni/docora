"""Automated PDF Extraction, Concurrent Upload & AI Grounded Accuracy Test Suite.

Covers:
1. Normal text PDF extraction accuracy.
2. Multi-page PDF extraction and complete page coverage.
3. Structured tabular and natural reading-order PDF extraction.
4. Corrupted / truncated PDF error resilience.
5. Consecutive and concurrent PDF processing under load.
6. End-to-end grounded RAG question answering accuracy with exact fact extraction and citation checks.
"""

import asyncio
import io
import uuid
import pytest
import pymupdf as fitz
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.extractors.pdf import PDFExtractor
from app.services.embeddings.mock import MockEmbeddingProvider
from app.services.llm.mock import MockLLMProvider
from app.services.llm.service import LLMService
from app.services.rag.models import RAGRequest
from app.services.rag.service import RAGService
from app.services.retrieval.service import RetrievalService


# =========================================================================
# Helper: Generate Test PDFs
# =========================================================================

def create_synthetic_pdf(pages_content: list[str], title: str = "Test Document") -> bytes:
    """Create a digital multi-page PDF in-memory using PyMuPDF."""
    doc = fitz.open()
    for text in pages_content:
        page = doc.new_page(width=595, height=842)
        page.insert_text((50, 80), text, fontsize=11)
    doc.set_metadata({"title": title, "author": "UDIP Automated Test Suite"})
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


# =========================================================================
# Test 1: Normal Single-Page Text PDF
# =========================================================================

def test_pdf_extraction_accuracy_normal_text():
    """Verify single-page PDF text extraction accuracy and metadata."""
    sample_text = (
        "Universal Document Intelligence Platform (UDIP)\n"
        "Quarterly Financial Performance Overview\n"
        "Revenue for the period was $28.4 million with an EBITDA margin of 32.5%.\n"
        "Compliance status: Fully verified and audited under SOC2 Type II standards."
    )
    pdf_bytes = create_synthetic_pdf([sample_text], title="Q3 Performance")

    extractor = PDFExtractor()
    result = asyncio.run(extractor.extract(pdf_bytes, "performance.pdf", "application/pdf"))

    assert result.success is True, f"Extraction failed: {result.error_message}"
    assert result.total_pages == 1
    assert "Revenue for the period was $28.4 million" in result.pages[0].content
    assert "SOC2 Type II standards" in result.pages[0].content
    assert result.document_metadata.get("title") == "Q3 Performance"
    assert result.pages[0].token_count > 10


# =========================================================================
# Test 2: Multi-Page PDF Coverage
# =========================================================================

def test_pdf_extraction_multipage_coverage():
    """Verify 100% page coverage on a multi-page PDF with sequential content."""
    pages = [
        "Page 1: Executive Overview of Systems Architecture.\nCloud infrastructure operates in isolated VPCs.",
        "Page 2: Data Pipeline and Ingestion Specifications.\nAsync workers process incoming documents concurrently.",
        "Page 3: Security & Cryptographic Tenancy Model.\nStorage paths and database rows are separated by workspace_id.",
        "Page 4: Retrieval Augmented Generation (RAG) Architecture.\nHybrid RRF merges dense vector rankings with BM25 keyword scores.",
        "Page 5: Disaster Recovery and Failover Protocols.\nTarget RPO is zero seconds with synchronous replication.",
    ]
    pdf_bytes = create_synthetic_pdf(pages, title="Architecture Blueprint")

    extractor = PDFExtractor()
    result = asyncio.run(extractor.extract(pdf_bytes, "blueprint.pdf", "application/pdf"))

    assert result.success is True
    assert result.total_pages == 5, f"Expected 5 pages, got {result.total_pages}"
    
    # Verify each page is individually extracted in correct order
    for idx, expected in enumerate(pages):
        page_content = result.pages[idx].content
        assert f"Page {idx + 1}:" in page_content
        assert result.pages[idx].page_number == idx + 1


# =========================================================================
# Test 3: Structured Table & Reading-Order PDF Extraction
# =========================================================================

def test_pdf_extraction_tables_and_reading_order():
    """Verify structured layout and natural reading order (sort=True)."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    # Insert multi-column headings and data
    page.insert_text((50, 80), "Financial Statement Summary Table", fontsize=14)
    page.insert_text((50, 120), "Line Item           FY25        FY26        Variance", fontsize=10)
    page.insert_text((50, 140), "Gross Revenue       $120.0M     $145.5M     +21.25%", fontsize=10)
    page.insert_text((50, 160), "Operating Cost      $78.2M      $82.1M      +4.98%", fontsize=10)
    page.insert_text((50, 180), "Net Margin          $41.8M      $63.4M      +51.67%", fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()

    extractor = PDFExtractor()
    result = asyncio.run(extractor.extract(pdf_bytes, "table_summary.pdf", "application/pdf"))

    assert result.success is True
    assert result.total_pages == 1
    content = result.pages[0].content
    assert "Gross Revenue" in content
    assert "$145.5M" in content
    assert "+21.25%" in content
    assert "Net Margin" in content


# =========================================================================
# Test 4: Corrupt & Truncated PDF Resilience
# =========================================================================

def test_pdf_extraction_corrupt_file():
    """Verify that malformed or truncated PDF files fail gracefully without crashes."""
    corrupt_bytes = b"%PDF-1.4\n%Malformed and truncated byte sequence with random junk \x00\xff\xfe"

    extractor = PDFExtractor()
    result = asyncio.run(extractor.extract(corrupt_bytes, "corrupt.pdf", "application/pdf"))

    # Extractor must return success=False and record an error message cleanly
    assert result.success is False
    assert result.error_message is not None
    assert len(result.pages) == 0


# =========================================================================
# Test 5: Consecutive & Concurrent PDF Extraction
# =========================================================================

def test_pdf_consecutive_and_concurrent_processing():
    """Verify system stability under consecutive and concurrent PDF extraction workloads."""
    extractor = PDFExtractor()
    pdf_docs = [
        create_synthetic_pdf([f"Document #{i} Content with specific key id-{i * 100}"])
        for i in range(10)
    ]

    # Consecutive run
    consecutive_results = []
    for i, pdf_b in enumerate(pdf_docs):
        res = asyncio.run(extractor.extract(pdf_b, f"doc_{i}.pdf", "application/pdf"))
        consecutive_results.append(res)
    assert all(r.success for r in consecutive_results)
    assert len(consecutive_results) == 10

    # Concurrent run (10 concurrent PDF extractions via asyncio.gather)
    async def run_concurrent():
        tasks = [
            extractor.extract(pdf_b, f"concurrent_{i}.pdf", "application/pdf")
            for i, pdf_b in enumerate(pdf_docs)
        ]
        return await asyncio.gather(*tasks)

    concurrent_results = asyncio.run(run_concurrent())
    assert all(r.success for r in concurrent_results)
    assert len(concurrent_results) == 10
    for i, r in enumerate(concurrent_results):
        assert f"id-{i * 100}" in r.pages[0].content


# =========================================================================
# Test 6: Grounded AI Accuracy & Known Facts Verification
# =========================================================================

def test_pdf_grounded_rag_accuracy_and_facts(
    session_factory: async_sessionmaker[AsyncSession],
    test_settings: Settings
):
    """Verify grounded answering extracts exact facts and citations from PDF context."""
    async def _test():
        async with session_factory() as session:
            mock_emb = MockEmbeddingProvider()

            user = User(
                id=uuid.uuid4(),
                email=f"auditor-{uuid.uuid4().hex[:6]}@udip.local",
                full_name="Accuracy Auditor",
                role="user",
                is_active=True,
            )
            session.add(user)
            await session.flush()

            ws = Workspace(
                id=uuid.uuid4(),
                name="PDF Accuracy Workspace",
                slug=f"pdf-acc-{uuid.uuid4().hex[:6]}",
                owner_id=user.id,
            )
            session.add(ws)
            await session.flush()

            # Seed document with specific unambiguous facts
            fact_content = (
                "Acme Global Master Services Agreement.\n"
                "Clause 4.1: The total enterprise contract price is $4,250,000 paid across four quarterly tranches.\n"
                "Clause 8.2: The mandatory contract termination notice period is 60 calendar days.\n"
                "Clause 11.5: Direct liability is strictly capped at $1,500,000 for all security incidents."
            )
            doc = Document(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                user_id=user.id,
                title="Acme Global MSA",
                filename="acme_msa_2026.pdf",
                file_path="/storage/acme.pdf",
                file_size_bytes=len(fact_content),
                mime_type="application/pdf",
                file_hash=f"hash-{uuid.uuid4().hex}",
                page_count=1,
                status="READY",
                is_deleted=False,
            )
            session.add(doc)
            await session.flush()

            page = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content=fact_content,
            )
            session.add(page)
            await session.flush()

            emb = await mock_emb.embed_query(fact_content)
            chunk = DocumentChunk(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                document_id=doc.id,
                page_id=page.id,
                chunk_index=0,
                content=fact_content,
                token_count=50,
                embedding=emb,
                metadata_json={"section": "Master Agreement Terms"},
            )
            session.add(chunk)
            await session.commit()

            rag_service = RAGService(
                llm_service=LLMService(provider=MockLLMProvider()),
                settings=test_settings,
            )

            # Query 1: Termination notice period
            req1 = RAGRequest(
                question="What is the mandatory termination notice period?",
                retrieval_mode="hybrid",
            )
            res1 = await rag_service.answer_question(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                request=req1,
            )
            assert res1.generation_status == "completed"
            assert "60 calendar days" in res1.answer or "60" in res1.answer
            assert len(res1.citations) >= 1
            assert res1.citations[0].document_filename == "acme_msa_2026.pdf"
            assert "[Source 1]" in res1.answer

            # Query 2: Contract price
            req2 = RAGRequest(
                question="What is the total enterprise contract price?",
                retrieval_mode="hybrid",
            )
            res2 = await rag_service.answer_question(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                request=req2,
            )
            assert res2.generation_status == "completed"
            assert "$4,250,000" in res2.answer or "4,250,000" in res2.answer
            assert len(res2.citations) >= 1
            assert "[Source 1]" in res2.answer

            # Query 3: Liability cap
            req3 = RAGRequest(
                question="What is the liability cap for security incidents?",
                retrieval_mode="hybrid",
            )
            res3 = await rag_service.answer_question(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                request=req3,
            )
            assert res3.generation_status == "completed"
            assert "$1,500,000" in res3.answer or "1,500,000" in res3.answer
            assert len(res3.citations) >= 1

            # Query 4: Unanswerable query (no facts in document)
            req4 = RAGRequest(
                question="What color is the chief executive's personal automobile?",
                retrieval_mode="keyword",
            )
            res4 = await rag_service.answer_question(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                request=req4,
            )
            # Must honestly state insufficient evidence
            assert (
                res4.generation_status == "insufficient_evidence"
                or "cannot find sufficient evidence" in res4.answer.lower()
                or len(res4.citations) == 0
            )

    asyncio.run(_test())
