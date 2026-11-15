"""Local CPU-Optimized Embedding Provider via FastEmbed (ONNX Runtime).

Executes sentence-transformers/all-MiniLM-L6-v2 locally with zero GPU dependencies
and low memory consumption (< 100 MB).
"""

import asyncio
from typing import List, Optional
import numpy as np

from app.core.logging import get_logger
from app.services.embeddings.base import BaseEmbeddingProvider, normalize_l2, validate_embedding_dimensions

logger = get_logger("embeddings.local")


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """Local ONNX-based sentence transformer producing 384-dimensional vectors."""

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        dimension: int = 384,
        batch_size: int = 16,
    ) -> None:
        super().__init__(model_name=model_name, dimension=dimension)
        self.batch_size = batch_size
        self._model = None

    def _get_model(self):
        """Lazy load ONNX model to save initialization time and RAM."""
        if self._model is None:
            try:
                from fastembed import TextEmbedding
                logger.info("Initializing local ONNX embedding model: %s", self.model_name)
                self._model = TextEmbedding(
                    model_name=self.model_name,
                    threads=2,
                )
            except Exception as e:
                logger.error("Failed to load FastEmbed model '%s': %s", self.model_name, e)
                raise
        return self._model

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate normalized 384-dimensional embeddings in batches."""
        if not texts:
            return []

        # Offload synchronous ONNX matrix multiplication to thread pool
        def _compute():
            model = self._get_model()
            # FastEmbed's model.embed returns a generator of numpy arrays
            raw_gen = model.embed(texts, batch_size=self.batch_size)
            results: List[List[float]] = []
            for vec in raw_gen:
                as_list = vec.tolist() if isinstance(vec, np.ndarray) else list(vec)
                normed = normalize_l2(as_list)
                validate_embedding_dimensions(normed, self.dimension)
                results.append(normed)
            return results

        return await asyncio.to_thread(_compute)

    async def embed_query(self, text: str) -> List[float]:
        """Compute embedding for a single search query."""
        results = await self.embed_documents([text])
        return results[0]
