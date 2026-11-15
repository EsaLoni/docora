"""Embedding Provider Factory.

Instantiates and caches configured embedding providers based on environment settings.
"""

from typing import Optional

from app.core.config import Settings, get_settings
from app.services.embeddings.base import BaseEmbeddingProvider
from app.services.embeddings.local import LocalEmbeddingProvider
from app.services.embeddings.mock import MockEmbeddingProvider


class EmbeddingProviderFactory:
    """Factory resolving embedding provider singletons."""

    _instance: Optional[BaseEmbeddingProvider] = None

    @classmethod
    def get_provider(cls, settings: Optional[Settings] = None) -> BaseEmbeddingProvider:
        """Return configured embedding provider instance."""
        if cls._instance is not None:
            return cls._instance

        cfg = settings or get_settings()
        provider_name = cfg.EMBEDDING_PROVIDER.lower().strip()

        if provider_name == "mock":
            cls._instance = MockEmbeddingProvider(
                model_name="mock-minilm-384",
                dimension=cfg.VECTOR_DIMENSION,
            )
        else:
            cls._instance = LocalEmbeddingProvider(
                model_name=cfg.EMBEDDING_MODEL_NAME,
                dimension=cfg.VECTOR_DIMENSION,
                batch_size=cfg.EMBEDDING_BATCH_SIZE,
            )

        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset cached provider singleton (useful in tests)."""
        cls._instance = None
