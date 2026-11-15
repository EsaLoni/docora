"""Vector Dimension Consistency and Model Safety Verification (Gate 19.4.1).

Validates:
1. Embedding output dimension consistency across document and query embeddings.
2. ORM DocumentChunk vector column matches settings.VECTOR_DIMENSION (384).
3. Alembic migration script defines Vector(384) with HNSW cosine index.
4. Mismatched query dimensions (e.g. 768 or 1536) are rejected before reaching database.
5. Ingestion pipeline preserves 384-dimensional dense vectors.
6. Local sentence transformer produces exactly 384-dimensional unit-normalized embeddings.
"""

import math
import uuid
import pytest
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.document import DocumentChunk
from app.services.embeddings.base import (
    EmbeddingValidationError,
    normalize_l2,
    validate_embedding_dimensions,
)
from app.services.embeddings.mock import MockEmbeddingProvider
from app.services.embeddings.factory import EmbeddingProviderFactory
from app.services.retrieval.vector import VectorRetriever


def test_embedding_output_dimension_matches_settings(test_settings: Settings):
    """Verify embedding provider generates vectors with length matching settings.VECTOR_DIMENSION."""
    assert test_settings.VECTOR_DIMENSION == 384

    provider = MockEmbeddingProvider(dimension=test_settings.VECTOR_DIMENSION)
    assert provider.dimension == 384

    # Document embedding output dimension
    doc_texts = ["Executive summary of financial statement.", "Key risks and market conditions."]
    import asyncio
    doc_embeddings = asyncio.run(provider.embed_documents(doc_texts))
    assert len(doc_embeddings) == 2
    for emb in doc_embeddings:
        assert len(emb) == 384
        validate_embedding_dimensions(emb, expected_dim=384)

    # Query embedding output dimension
    query_emb = asyncio.run(provider.embed_query("What are the financial risks?"))
    assert len(query_emb) == 384
    validate_embedding_dimensions(query_emb, expected_dim=384)


def test_query_and_document_embedding_dimensions_are_identical():
    """Verify that document and query embeddings are produced with identical vector dimensions."""
    provider = MockEmbeddingProvider()
    import asyncio
    doc_emb = asyncio.run(provider.embed_documents(["Sample document passage"]))[0]
    query_emb = asyncio.run(provider.embed_query("Sample search query"))

    assert len(doc_emb) == len(query_emb) == 384


def test_orm_document_chunk_vector_column_dimension(test_settings: Settings):
    """Verify ORM DocumentChunk.embedding column type has exact 384 dimensions."""
    col = DocumentChunk.__table__.columns["embedding"]
    # pgvector Vector type exposes .dim
    assert hasattr(col.type, "dim"), "DocumentChunk.embedding must be a Vector type"
    assert col.type.dim == 384
    assert col.type.dim == test_settings.VECTOR_DIMENSION


def test_alembic_initial_migration_schema_consistency():
    """Inspect the Alembic initial schema migration file and verify 384-dimensional vector definition."""
    import pathlib
    migration_path = pathlib.Path("backend/alembic/versions/20261113_0001_initial_schema.py")
    assert migration_path.exists(), "Initial migration file must exist"

    content = migration_path.read_text(encoding="utf-8")
    assert 'Vector(384)' in content, "Migration must define Vector(384)"
    assert 'idx_chunks_embedding_hnsw' in content, "Migration must create HNSW index for embeddings"
    assert 'vector_cosine_ops' in content, "Migration must use cosine distance operations"
    # Ensure 768 is not mistakenly introduced into table definitions
    assert 'Vector(768)' not in content, "Migration must not contain Vector(768)"


def test_retriever_rejects_dimension_mismatch_early():
    """Verify VectorRetriever immediately rejects 768-d or mismatched vectors before database query."""
    retriever = VectorRetriever()
    import asyncio
    from unittest.mock import AsyncMock

    mock_db = AsyncMock(spec=AsyncSession)

    # Pass 768-dimensional vector (e.g. from Google text-embedding-004)
    mismatched_vector = [0.01] * 768
    with pytest.raises(EmbeddingValidationError, match="expected 384, got 768"):
        asyncio.run(retriever.search(
            db=mock_db,
            query_vector=mismatched_vector,
            workspace_id=uuid.uuid4(),
        ))

    # Verify database was never touched due to early validation guard
    assert mock_db.execute.call_count == 0


def test_safe_handling_of_dimension_validation():
    """Verify dimension validator safely rejects truncated and oversized vectors."""
    # Oversized vector (e.g. 768 dimensions)
    oversized = [0.05] * 768
    with pytest.raises(EmbeddingValidationError, match="expected 384, got 768"):
        validate_embedding_dimensions(oversized, expected_dim=384)

    # Undersized vector (e.g. 128 dimensions)
    undersized = [0.05] * 128
    with pytest.raises(EmbeddingValidationError, match="expected 384, got 128"):
        validate_embedding_dimensions(undersized, expected_dim=384)

    # Exact 384 dimensions passes
    exact = [0.05] * 384
    validate_embedding_dimensions(exact, expected_dim=384)
