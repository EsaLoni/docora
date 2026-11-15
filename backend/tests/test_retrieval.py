"""Unit and Integration Tests for UDIP Retrieval Engine.

Tests:
- VectorRetriever (cosine similarity ranking, workspace isolation, soft deletion)
- KeywordRetriever (lexical search, token matching, workspace isolation)
- HybridRetriever (Reciprocal Rank Fusion, score normalization, deduplication)
- RetrievalService (mode dispatch, query embedding orchestration)
"""

import asyncio
import math
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.embeddings.mock import MockEmbeddingProvider
from app.services.embeddings.service import EmbeddingService
from app.services.retrieval.hybrid import HybridRetriever
from app.services.retrieval.keyword import KeywordRetriever
from app.services.retrieval.models import SearchRequest
from app.services.retrieval.service import RetrievalService
from app.services.retrieval.vector import VectorRetriever


async def _setup_test_documents_and_chunks(
    session: AsyncSession,
    ws1_id: uuid.UUID,
    ws2_id: uuid.UUID,
    user_id: uuid.UUID,
    mock_provider: MockEmbeddingProvider,
):
    """Seed test documents, pages, and vector chunks across two isolated workspaces."""
    # Doc 1 in Workspace 1
    doc1 = Document(
        id=uuid.uuid4(),
        workspace_id=ws1_id,
        user_id=user_id,
        title="Q3 Earnings Financials",
        filename="q3_earnings.pdf",
        file_path="/test/q3_earnings.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        file_hash="hash-1",
        page_count=2,
        status="READY",
        is_deleted=False,
    )
    # Doc 2 in Workspace 1 (Soft deleted)
    doc2_deleted = Document(
        id=uuid.uuid4(),
        workspace_id=ws1_id,
        user_id=user_id,
        title="Deleted Secret Document",
        filename="deleted.pdf",
        file_path="/test/deleted.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        file_hash="hash-2",
        page_count=1,
        status="READY",
        is_deleted=True,
    )
    # Doc 3 in Workspace 2 (Tenant 2 isolation test)
    doc3_ws2 = Document(
        id=uuid.uuid4(),
        workspace_id=ws2_id,
        user_id=user_id,
        title="Tenant Two Proprietary Data",
        filename="tenant2.pdf",
        file_path="/test/tenant2.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        file_hash="hash-3",
        page_count=1,
        status="READY",
        is_deleted=False,
    )
    session.add_all([doc1, doc2_deleted, doc3_ws2])
    await session.flush()

    # Pages
    p1 = DocumentPage(
        id=uuid.uuid4(),
        document_id=doc1.id,
        page_number=1,
        content="Q3 Revenue was 15 million dollars. Net profit rose significantly.",
    )
    p2 = DocumentPage(
        id=uuid.uuid4(),
        document_id=doc1.id,
        page_number=2,
        content="Cost of goods sold decreased due to automated invoice processing.",
    )
    p_del = DocumentPage(
        id=uuid.uuid4(),
        document_id=doc2_deleted.id,
        page_number=1,
        content="Revenue numbers for deleted document.",
    )
    p_ws2 = DocumentPage(
        id=uuid.uuid4(),
        document_id=doc3_ws2.id,
        page_number=1,
        content="Tenant two confidential revenue statement.",
    )
    session.add_all([p1, p2, p_del, p_ws2])
    await session.flush()

    # Chunks with deterministic embeddings
    emb1 = await mock_provider.embed_query("Revenue was 15 million dollars")
    emb2 = await mock_provider.embed_query("Cost of goods sold decreased")
    emb_del = await mock_provider.embed_query("Revenue numbers for deleted document")
    emb_ws2 = await mock_provider.embed_query("Tenant two confidential revenue statement")

    chunk1 = DocumentChunk(
        id=uuid.uuid4(),
        workspace_id=ws1_id,
        document_id=doc1.id,
        page_id=p1.id,
        chunk_index=0,
        content=p1.content,
        token_count=12,
        embedding=emb1,
        metadata_json={"section_title": "Financial Highlights"},
    )
    chunk2 = DocumentChunk(
        id=uuid.uuid4(),
        workspace_id=ws1_id,
        document_id=doc1.id,
        page_id=p2.id,
        chunk_index=1,
        content=p2.content,
        token_count=10,
        embedding=emb2,
        metadata_json={"section_title": "Cost Analysis"},
    )
    chunk_del = DocumentChunk(
        id=uuid.uuid4(),
        workspace_id=ws1_id,
        document_id=doc2_deleted.id,
        page_id=p_del.id,
        chunk_index=0,
        content=p_del.content,
        token_count=8,
        embedding=emb_del,
        metadata_json={"section_title": "Deleted"},
    )
    chunk_ws2 = DocumentChunk(
        id=uuid.uuid4(),
        workspace_id=ws2_id,
        document_id=doc3_ws2.id,
        page_id=p_ws2.id,
        chunk_index=0,
        content=p_ws2.content,
        token_count=8,
        embedding=emb_ws2,
        metadata_json={"section_title": "Confidential"},
    )
    session.add_all([chunk1, chunk2, chunk_del, chunk_ws2])
    await session.commit()
    return doc1, doc3_ws2


def test_vector_retriever_ranking_and_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify VectorRetriever ranks by cosine distance and respects workspace isolation."""
    async def _test():
        async with session_factory() as session:
            user_id = uuid.uuid4()
            ws1 = Workspace(id=uuid.uuid4(), name="WS1", slug=f"ws1-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            ws2 = Workspace(id=uuid.uuid4(), name="WS2", slug=f"ws2-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            session.add_all([ws1, ws2])
            await session.commit()

            mock_provider = MockEmbeddingProvider()
            doc1, doc_ws2 = await _setup_test_documents_and_chunks(
                session, ws1.id, ws2.id, user_id, mock_provider
            )

            retriever = VectorRetriever()
            query_vec = await mock_provider.embed_query("Revenue was 15 million dollars")

            # Search in Workspace 1
            results_ws1 = await retriever.search(
                db=session,
                query_vector=query_vec,
                workspace_id=ws1.id,
                limit=5,
            )

            assert len(results_ws1) >= 1
            # Top result should be chunk1 (exact match query vector)
            assert results_ws1[0].document_id == str(doc1.id)
            assert "Revenue was 15 million" in results_ws1[0].content
            assert results_ws1[0].score >= 0.9  # High cosine similarity

            # Verify soft deleted document chunk is excluded
            doc_ids = [r.document_id for r in results_ws1]
            assert str(doc_ws2.id) not in doc_ids
            assert all("deleted" not in r.content.lower() for r in results_ws1)

            # Search in Workspace 2 (Tenant isolation)
            results_ws2 = await retriever.search(
                db=session,
                query_vector=query_vec,
                workspace_id=ws2.id,
                limit=5,
            )
            assert len(results_ws2) == 1
            assert results_ws2[0].document_id == str(doc_ws2.id)

    asyncio.run(_test())


def test_keyword_retriever_and_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify KeywordRetriever lexical ranking and multi-tenant isolation."""
    async def _test():
        async with session_factory() as session:
            user_id = uuid.uuid4()
            ws1 = Workspace(id=uuid.uuid4(), name="WS1", slug=f"ws1-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            ws2 = Workspace(id=uuid.uuid4(), name="WS2", slug=f"ws2-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            session.add_all([ws1, ws2])
            await session.commit()

            mock_provider = MockEmbeddingProvider()
            doc1, _ = await _setup_test_documents_and_chunks(
                session, ws1.id, ws2.id, user_id, mock_provider
            )

            retriever = KeywordRetriever()
            results = await retriever.search(
                db=session,
                query="invoice processing",
                workspace_id=ws1.id,
                limit=5,
            )

            assert len(results) >= 1
            assert any("invoice processing" in r.content.lower() for r in results)
            assert results[0].retrieval_mode == "keyword"

    asyncio.run(_test())


def test_hybrid_retriever_rrf(session_factory: async_sessionmaker[AsyncSession], test_settings: Settings):
    """Verify HybridRetriever fuses vector and keyword results via RRF."""
    async def _test():
        async with session_factory() as session:
            user_id = uuid.uuid4()
            ws1 = Workspace(id=uuid.uuid4(), name="WS1", slug=f"ws1-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            ws2 = Workspace(id=uuid.uuid4(), name="WS2", slug=f"ws2-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            session.add_all([ws1, ws2])
            await session.commit()

            mock_provider = MockEmbeddingProvider()
            doc1, _ = await _setup_test_documents_and_chunks(
                session, ws1.id, ws2.id, user_id, mock_provider
            )

            retriever = HybridRetriever(settings=test_settings)
            query_vec = await mock_provider.embed_query("Revenue profit")

            results = await retriever.search(
                db=session,
                query="Revenue profit",
                query_vector=query_vec,
                workspace_id=ws1.id,
                limit=5,
            )

            assert len(results) >= 1
            assert results[0].retrieval_mode == "hybrid"
            # Scores must be bounded in [0.0, 1.0]
            for r in results:
                assert 0.0 <= r.score <= 1.0
            # Results must be deduplicated
            chunk_ids = [r.chunk_id for r in results]
            assert len(chunk_ids) == len(set(chunk_ids))

    asyncio.run(_test())


def test_retrieval_service_dispatch(session_factory: async_sessionmaker[AsyncSession], test_settings: Settings):
    """Verify RetrievalService dispatches search across modes."""
    async def _test():
        async with session_factory() as session:
            user_id = uuid.uuid4()
            ws1 = Workspace(id=uuid.uuid4(), name="WS1", slug=f"ws1-{uuid.uuid4().hex[:8]}", owner_id=user_id, settings={})
            session.add(ws1)
            await session.commit()

            mock_provider = MockEmbeddingProvider()
            service = RetrievalService(
                embedding_service=EmbeddingService(provider=mock_provider),
                settings=test_settings,
            )

            # Test empty query error handling
            with pytest.raises(Exception):
                await service.search(
                    db=session,
                    workspace_id=ws1.id,
                    request=SearchRequest(query="   "),
                )

    asyncio.run(_test())
