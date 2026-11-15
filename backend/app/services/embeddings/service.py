"""High-Level Embedding Generation Service.

Handles batch embedding of chunks, retry backoff for transient issues,
and output validation.
"""

import asyncio
from typing import List, Optional

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.chunking.models import DocumentChunkResult
from app.services.embeddings.base import BaseEmbeddingProvider, validate_embedding_dimensions
from app.services.embeddings.factory import EmbeddingProviderFactory

logger = get_logger("services.embeddings")


class EmbeddingService:
    """Service wrapping embedding providers with retries, validation, and batching."""

    MAX_RETRIES = 2

    def __init__(
        self,
        provider: Optional[BaseEmbeddingProvider] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.provider = provider or EmbeddingProviderFactory.get_provider(self.settings)

    async def embed_chunks(self, chunks: List[DocumentChunkResult]) -> List[List[float]]:
        """Generate embeddings for a list of document chunks with retry support."""
        if not chunks:
            return []

        texts = [c.content for c in chunks]
        last_error = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                embeddings = await self.provider.embed_documents(texts)
                if len(embeddings) != len(chunks):
                    raise ValueError(
                        f"Provider returned {len(embeddings)} vectors for {len(chunks)} chunks."
                    )
                for vec in embeddings:
                    validate_embedding_dimensions(vec, self.provider.dimension)
                return embeddings
            except Exception as e:
                last_error = e
                logger.warning(
                    "Embedding generation attempt %d/%d failed: %s",
                    attempt + 1, self.MAX_RETRIES + 1, e,
                )
                if attempt < self.MAX_RETRIES:
                    await asyncio.sleep(0.5 * (attempt + 1))

        raise RuntimeError(f"Failed to generate embeddings after {self.MAX_RETRIES + 1} attempts: {last_error}")

    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding vector for a user search query."""
        clean_q = query.strip()
        if not clean_q:
            raise ValueError("Query string cannot be empty.")

        vec = await self.provider.embed_query(clean_q)
        validate_embedding_dimensions(vec, self.provider.dimension)
        return vec
