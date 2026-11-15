"""UDIP Embeddings Package."""

from app.services.embeddings.base import (
    BaseEmbeddingProvider,
    EmbeddingValidationError,
    normalize_l2,
    validate_embedding_dimensions,
)
from app.services.embeddings.factory import EmbeddingProviderFactory
from app.services.embeddings.local import LocalEmbeddingProvider
from app.services.embeddings.mock import MockEmbeddingProvider
from app.services.embeddings.service import EmbeddingService

__all__ = [
    "BaseEmbeddingProvider",
    "EmbeddingValidationError",
    "normalize_l2",
    "validate_embedding_dimensions",
    "LocalEmbeddingProvider",
    "MockEmbeddingProvider",
    "EmbeddingProviderFactory",
    "EmbeddingService",
]
