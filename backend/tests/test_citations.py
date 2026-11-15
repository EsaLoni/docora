"""Unit and Integration Tests for UDIP Citations and Citation Security.

Tests:
- CitationBuilder (bracketed anchor extraction, fallback heuristics)
- CitationValidator (workspace boundary verification, forged chunk rejection, soft deletion)
"""

import asyncio
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.rag.citation_builder import CitationBuilder
from app.services.rag.citation_validator import CitationValidator
from app.services.rag.models import AssembledContext, CitationDTO
from app.services.retrieval.models import SearchResultItem


def test_citation_builder_anchor_parsing():
    """Verify CitationBuilder extracts [Source N] anchors and matches sources map."""
    builder = CitationBuilder()
    chunk1 = SearchResultItem(
        chunk_id="chunk-1",
        document_id="doc-1",
        document_filename="q3.pdf",
        document_title="Q3",
        page_number=2,
        content="Revenue rose 14% to $20M.",
        score=0.92,
        retrieval_mode="hybrid",
    )
    chunk2 = SearchResultItem(
        chunk_id="chunk-2",
        document_id="doc-2",
        document_filename="msa.docx",
        document_title="MSA",
        page_number=5,
        content="Liability is capped at 12 months fees.",
        score=0.88,
        retrieval_mode="hybrid",
    )
    context = AssembledContext(
        context_text="...",
        chunks=[chunk1, chunk2],
        total_tokens=20,
        sources_map={1: chunk1, 2: chunk2},
    )

    answer = "Operating revenue expanded by 14% [Source 1], while liability remains capped [Source 2]."
    citations = builder.extract_citations(answer, context)

    assert len(citations) == 2
    assert citations[0].document_id == "doc-1"
    assert citations[0].page_number == 2
    assert citations[0].chunk_id == "chunk-1"
    assert "Revenue rose" in citations[0].quote

    assert citations[1].document_id == "doc-2"
    assert citations[1].page_number == 5
    assert citations[1].chunk_id == "chunk-2"


def test_citation_validator_forged_chunk_rejection(session_factory: async_sessionmaker[AsyncSession]):
    """Verify CitationValidator rejects forged or fabricated chunk IDs not in retrieval pool."""
    async def _test():
        async with session_factory() as session:
            validator = CitationValidator()
            ws_id = uuid.uuid4()
            real_chunk = SearchResultItem(
                chunk_id=str(uuid.uuid4()),
                document_id=str(uuid.uuid4()),
                document_filename="real.pdf",
                document_title="Real",
                page_number=1,
                content="Valid content.",
                score=0.9,
                retrieval_mode="hybrid",
            )
            context = AssembledContext(
                context_text="...",
                chunks=[real_chunk],
                total_tokens=10,
                sources_map={1: real_chunk},
            )

            # Forged citation referencing a non-retrieved chunk UUID
            forged_citation = CitationDTO(
                document_id=str(uuid.uuid4()),
                document_filename="forged.pdf",
                chunk_id=str(uuid.uuid4()),  # Forged
                page_number=99,
                quote="Forged quote.",
                citation_index=1,
            )

            validated = await validator.validate_citations(
                db=session,
                workspace_id=ws_id,
                citations=[forged_citation],
                context=context,
            )
            assert len(validated) == 0

    asyncio.run(_test())


def test_citation_validator_cross_workspace_rejection(session_factory: async_sessionmaker[AsyncSession]):
    """Verify CitationValidator prevents citations from another tenant workspace."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email="cit_test@udip.local", full_name="User", is_active=True)
            ws_a = Workspace(id=uuid.uuid4(), name="WS A", slug=f"wsa-{uuid.uuid4().hex[:8]}", owner_id=user.id, settings={})
            ws_b = Workspace(id=uuid.uuid4(), name="WS B", slug=f"wsb-{uuid.uuid4().hex[:8]}", owner_id=user.id, settings={})
            session.add_all([user, ws_a, ws_b])
            await session.flush()

            # Create document and chunk in Workspace B
            doc_b = Document(
                id=uuid.uuid4(),
                workspace_id=ws_b.id,
                user_id=user.id,
                title="WS B Doc",
                filename="wsb.pdf",
                file_path="/wsb.pdf",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="hb",
                page_count=1,
                status="READY",
                is_deleted=False,
            )
            session.add(doc_b)
            await session.flush()

            page_b = DocumentPage(id=uuid.uuid4(), document_id=doc_b.id, page_number=1, content="Content in WS B")
            session.add(page_b)
            await session.flush()

            chunk_b = DocumentChunk(
                id=uuid.uuid4(),
                workspace_id=ws_b.id,
                document_id=doc_b.id,
                page_id=page_b.id,
                chunk_index=0,
                content="Content in WS B",
                token_count=5,
                embedding=[0.0] * 384,
                metadata_json={},
            )
            session.add(chunk_b)
            await session.commit()

            # Attempt to validate this chunk under Workspace A
            search_item = SearchResultItem(
                chunk_id=str(chunk_b.id),
                document_id=str(doc_b.id),
                document_filename=doc_b.filename,
                document_title=doc_b.title,
                page_number=1,
                content="Content in WS B",
                score=0.9,
                retrieval_mode="hybrid",
            )
            context = AssembledContext(
                context_text="...",
                chunks=[search_item],
                total_tokens=5,
                sources_map={1: search_item},
            )

            cite = CitationDTO(
                document_id=str(doc_b.id),
                document_filename=doc_b.filename,
                chunk_id=str(chunk_b.id),
                page_number=1,
                quote="Content in WS B",
                citation_index=1,
            )

            validator = CitationValidator()
            # Workspace A caller must NOT be permitted to cite Workspace B chunks
            validated = await validator.validate_citations(
                db=session,
                workspace_id=ws_a.id,
                citations=[cite],
                context=context,
            )
            assert len(validated) == 0

    asyncio.run(_test())
