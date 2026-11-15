"""Base Embedding Provider and Vector Validation Utilities.

Defines the contract for embedding providers, dimension checks,
and L2 unit normalization for pgvector cosine compatibility.
"""

from abc import ABC, abstractmethod
import math
from typing import List

from app.core.exceptions import UDIPException


class EmbeddingValidationError(UDIPException):
    """Raised when an embedding output violates dimensionality or formatting contracts."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(
            message=message,
            status_code=500,
            error_code="EMBEDDING_VALIDATION_ERROR",
            details=details,
        )


def normalize_l2(vector: List[float]) -> List[float]:
    """Normalize a vector to unit L2 length (euclidean norm = 1.0)."""
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0.0 or math.isnan(norm):
        return [0.0] * len(vector)
    return [round(x / norm, 7) for x in vector]


def validate_embedding_dimensions(vector: List[float], expected_dim: int = 384) -> None:
    """Validate vector length and numerical integrity."""
    if not vector:
        raise EmbeddingValidationError("Generated embedding vector is empty.")
    if len(vector) != expected_dim:
        raise EmbeddingValidationError(
            f"Embedding vector dimension mismatch: expected {expected_dim}, got {len(vector)}.",
            details={"expected": expected_dim, "actual": len(vector)},
        )
    if any(math.isnan(x) or math.isinf(x) for x in vector):
        raise EmbeddingValidationError("Embedding contains NaN or Infinite float values.")


class BaseEmbeddingProvider(ABC):
    """Abstract interface for all embedding generation providers."""

    def __init__(self, model_name: str, dimension: int = 384) -> None:
        self.model_name = model_name
        self.dimension = dimension

    @abstractmethod
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Compute 384-dimensional embeddings for a batch of text passages.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of L2-normalized float vectors.
        """
        pass

    @abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """Compute 384-dimensional embedding for a search query.

        Args:
            text: Query string.

        Returns:
            L2-normalized float vector.
        """
        pass
