"""Hybrid Retriever with Reciprocal Rank Fusion (RRF).

Combines vector semantic similarity and keyword lexical search into a single
deduplicated, calibrated ranking score.
"""

from typing import Dict, List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.retrieval.keyword import KeywordRetriever
from app.services.retrieval.models import SearchResultItem
from app.services.retrieval.vector import VectorRetriever

logger = get_logger("retrieval.hybrid")


class HybridRetriever:
    """Combines vector and keyword search results using Reciprocal Rank Fusion."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.vector_retriever = VectorRetriever()
        self.keyword_retriever = KeywordRetriever()
        self.rrf_k = getattr(self.settings, "RETRIEVAL_RRF_K", 60)
        self.vector_weight = getattr(self.settings, "HYBRID_RETRIEVAL_ALPHA", 0.6)
        self.keyword_weight = 1.0 - self.vector_weight

    async def search(
        self,
        db: AsyncSession,
        query: str,
        query_vector: List[float],
        workspace_id: uuid.UUID,
        limit: int = 10,
        document_id: Optional[uuid.UUID] = None,
        folder_id: Optional[uuid.UUID] = None,
    ) -> List[SearchResultItem]:
        """Perform hybrid retrieval with RRF scoring and deduplication."""
        # Fetch candidate pools from both retrievers (fetching up to 2x limit for rich merge)
        candidate_limit = max(limit * 2, 20)

        vector_results = await self.vector_retriever.search(
            db=db,
            query_vector=query_vector,
            workspace_id=workspace_id,
            limit=candidate_limit,
            document_id=document_id,
            folder_id=folder_id,
        )

        keyword_results = await self.keyword_retriever.search(
            db=db,
            query=query,
            workspace_id=workspace_id,
            limit=candidate_limit,
            document_id=document_id,
            folder_id=folder_id,
        )

        # RRF Score Accumulation
        rrf_scores: Dict[str, float] = {}
        chunk_map: Dict[str, SearchResultItem] = {}

        # 1. Process vector results
        for rank_0, item in enumerate(vector_results):
            cid = item.chunk_id
            chunk_map[cid] = item
            rank_1 = rank_0 + 1
            score = self.vector_weight / (self.rrf_k + rank_1)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + score

        # 2. Process keyword results
        for rank_0, item in enumerate(keyword_results):
            cid = item.chunk_id
            if cid not in chunk_map:
                chunk_map[cid] = item
            rank_1 = rank_0 + 1
            score = self.keyword_weight / (self.rrf_k + rank_1)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + score

        if not rrf_scores:
            return []

        # Sort chunk IDs by accumulated RRF score descending
        sorted_cids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)
        top_cids = sorted_cids[:limit]

        # Calculate max possible RRF score to normalize between [0.0, 1.0]
        max_possible_rrf = (self.vector_weight / (self.rrf_k + 1)) + (self.keyword_weight / (self.rrf_k + 1))

        final_results: List[SearchResultItem] = []
        for cid in top_cids:
            orig = chunk_map[cid]
            raw_rrf = rrf_scores[cid]
            calibrated_score = round(min(1.0, raw_rrf / max_possible_rrf), 4)

            # Mark retrieval mode as hybrid
            final_results.append(
                SearchResultItem(
                    chunk_id=orig.chunk_id,
                    document_id=orig.document_id,
                    document_filename=orig.document_filename,
                    document_title=orig.document_title,
                    page_number=orig.page_number,
                    content=orig.content,
                    section_title=orig.section_title,
                    score=calibrated_score,
                    retrieval_mode="hybrid",
                    metadata={
                        **orig.metadata,
                        "raw_rrf_score": round(raw_rrf, 6),
                    },
                )
            )

        return final_results
