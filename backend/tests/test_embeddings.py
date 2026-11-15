"""Unit and Integration Tests for UDIP Vector Embedding Engine.

Tests:
- Vector normalization (L2 norm)
- Dimension validation (384 dimensions)
- MockEmbeddingProvider (deterministic vectors for offline testing)
- EmbeddingProviderFactory (singleton caching, reset)
- EmbeddingService (chunk batch embedding, query embedding)
"""

import asyncio
import math
import uuid
import pytest
from app.core.config import Settings
from app.services.chunking.models import ChunkType, DocumentChunkResult
from app.services.embeddings.base import (
    EmbeddingValidationError,
    normalize_l2,
    validate_embedding_dimensions,
)
from app.services.embeddings.factory import EmbeddingProviderFactory
from app.services.embeddings.mock import MockEmbeddingProvider
from app.services.embeddings.service import EmbeddingService


def test_normalize_l2():
    """Verify L2 unit normalization produces vectors with unit norm."""
    vec = [3.0, 4.0, 0.0]
    normalized = normalize_l2(vec)
    norm = math.sqrt(sum(x * x for x in normalized))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)

    # Zero vector should return zero vector without divide-by-zero
    zero_vec = [0.0, 0.0, 0.0]
    assert normalize_l2(zero_vec) == [0.0, 0.0, 0.0]


def test_validate_embedding_dimensions():
    """Verify validation passes 384-dim finite vectors and rejects improper dimensions."""
    valid_vec = [0.1] * 384
    validate_embedding_dimensions(valid_vec, expected_dim=384)

    # Wrong dimension
    with pytest.raises(EmbeddingValidationError, match="expected 384, got 128"):
        validate_embedding_dimensions([0.1] * 128, expected_dim=384)

    # NaN / Inf validation
    with pytest.raises(EmbeddingValidationError, match="contains NaN or Inf"):
        nan_vec = [0.1] * 384
        nan_vec[10] = float("nan")
        validate_embedding_dimensions(nan_vec, expected_dim=384)


def test_mock_embedding_provider():
    """Verify MockEmbeddingProvider generates deterministic 384-dim normalized vectors."""
    provider = MockEmbeddingProvider()
    assert provider.dimension == 384
    assert provider.model_name == "mock-minilm-384"

    async def _test():
        return await provider.embed_documents(["Hello world", "Hello world", "Different text"])

    embeddings = asyncio.run(_test())
    assert len(embeddings) == 3
    for emb in embeddings:
        assert len(emb) == 384
        norm = math.sqrt(sum(x * x for x in emb))
        assert math.isclose(norm, 1.0, rel_tol=1e-5)

    # Determinism: identical input texts must produce identical vectors
    assert embeddings[0] == embeddings[1]
    # Different input texts produce different vectors
    assert embeddings[0] != embeddings[2]


def test_embedding_provider_factory(test_settings: Settings):
    """Verify provider factory singleton caching and switching."""
    EmbeddingProviderFactory.reset()
    mock_settings = test_settings.model_copy(update={"EMBEDDING_PROVIDER": "mock"})
    mock_p1 = EmbeddingProviderFactory.get_provider(mock_settings)
    mock_p2 = EmbeddingProviderFactory.get_provider(mock_settings)
    assert mock_p1 is mock_p2
    assert isinstance(mock_p1, MockEmbeddingProvider)
    EmbeddingProviderFactory.reset()


def test_embedding_service_embed_chunks():
    """Verify EmbeddingService attaches normalized embeddings to chunk objects."""
    provider = MockEmbeddingProvider()
    service = EmbeddingService(provider=provider)
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    page_id = uuid.uuid4()

    chunks = [
        DocumentChunkResult(
            chunk_index=0,
            workspace_id=ws_id,
            document_id=doc_id,
            page_id=page_id,
            page_number=1,
            content="First chunk text for embedding test.",
            token_count=10,
            chunk_type=ChunkType.TEXT,
        ),
        DocumentChunkResult(
            chunk_index=1,
            workspace_id=ws_id,
            document_id=doc_id,
            page_id=page_id,
            page_number=1,
            content="Second chunk text for embedding test.",
            token_count=10,
            chunk_type=ChunkType.TEXT,
        ),
    ]

    async def _test():
        return await service.embed_chunks(chunks)

    embeddings = asyncio.run(_test())
    assert len(embeddings) == 2
    for emb in embeddings:
        assert len(emb) == 384
        norm = math.sqrt(sum(x * x for x in emb))
        assert math.isclose(norm, 1.0, rel_tol=1e-5)


def test_embedding_service_embed_query():
    """Verify EmbeddingService embeds a search query string."""
    provider = MockEmbeddingProvider()
    service = EmbeddingService(provider=provider)

    async def _test():
        return await service.embed_query("What are the quarterly profits?")

    query_vec = asyncio.run(_test())
    assert len(query_vec) == 384
    norm = math.sqrt(sum(x * x for x in query_vec))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)
