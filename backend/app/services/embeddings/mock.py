"""Deterministic Mock Embedding Provider for Testing and Offline Mode.

Produces reproducible 384-dimensional unit-normalized vectors derived from text hashes.
"""

import hashlib
import struct
from typing import List

from app.services.embeddings.base import BaseEmbeddingProvider, normalize_l2, validate_embedding_dimensions


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """Deterministic embedding provider that creates valid 384-dim normalized vectors."""

    def __init__(self, model_name: str = "mock-minilm-384", dimension: int = 384) -> None:
        super().__init__(model_name=model_name, dimension=dimension)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate deterministic normalized vectors for a batch of strings."""
        return [self._generate_vector(t) for t in texts]

    async def embed_query(self, text: str) -> List[float]:
        """Generate deterministic normalized vector for a query string."""
        return self._generate_vector(text)

    def _generate_vector(self, text: str) -> List[float]:
        """Convert string to 384 pseudo-random floats using chained SHA-256 hashes."""
        raw_values = []
        seed = text.encode("utf-8")
        block_idx = 0

        while len(raw_values) < self.dimension:
            h = hashlib.sha256(seed + struct.pack("<I", block_idx)).digest()
            # Unpack 8 32-bit signed integers and scale to [-1.0, 1.0]
            ints = struct.unpack("<8i", h)
            scaled = [val / 2147483648.0 for val in ints]
            raw_values.extend(scaled)
            block_idx += 1

        trimmed = raw_values[:self.dimension]
        normalized = normalize_l2(trimmed)
        validate_embedding_dimensions(normalized, self.dimension)
        return normalized
