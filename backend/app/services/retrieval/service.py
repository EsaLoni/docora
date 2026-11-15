"""Unified Document Retrieval Service.

Dispatches search requests across Vector, Keyword, and Hybrid retrieval engines
while enforcing workspace isolation and embedding calculation.
"""

from typing import List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.embeddings.service import EmbeddingService
from app.services.retrieval.hybrid import HybridRetriever
from app.services.retrieval.keyword import KeywordRetriever
from app.services.retrieval.models import SearchRequest, SearchResponse, SearchResultItem
from app.services.retrieval.vector import VectorRetriever

logger = get_logger("services.retrieval")


class RetrievalService:
    """Service executing search queries across documents within a tenant workspace."""

    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.embedding_service = embedding_service or EmbeddingService(settings=self.settings)
        self.vector_retriever = VectorRetriever()
        self.keyword_retriever = KeywordRetriever()
        self.hybrid_retriever = HybridRetriever(settings=self.settings)

    async def search(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        request: SearchRequest,
    ) -> SearchResponse:
        """Execute search with specified mode, returning ranked results."""
        clean_query = request.query.strip()
        limit = min(request.limit, getattr(self.settings, "MAX_SEARCH_LIMIT", 50))
        mode = request.mode.lower()

        logger.info(
            "Executing %s search in workspace %s: '%s' (limit: %d)",
            mode, workspace_id, clean_query[:50], limit,
        )

        results: List[SearchResultItem] = []

        if mode == "keyword":
            results = await self.keyword_retriever.search(
                db=db,
                query=clean_query,
                workspace_id=workspace_id,
                limit=limit,
                document_id=request.document_id,
                folder_id=request.folder_id,
            )

        elif mode == "vector":
            query_vector = await self.embedding_service.embed_query(clean_query)
            results = await self.vector_retriever.search(
                db=db,
                query_vector=query_vector,
                workspace_id=workspace_id,
                limit=limit,
                document_id=request.document_id,
                folder_id=request.folder_id,
            )

        else:  # "hybrid"
            query_vector = await self.embedding_service.embed_query(clean_query)
            results = await self.hybrid_retriever.search(
                db=db,
                query=clean_query,
                query_vector=query_vector,
                workspace_id=workspace_id,
                limit=limit,
                document_id=request.document_id,
                folder_id=request.folder_id,
            )

        return SearchResponse(
            query=clean_query,
            mode=mode,
            total_results=len(results),
            workspace_id=str(workspace_id),
            results=results,
        )
