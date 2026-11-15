"""RAG Context Builder.

Deduplicates, scores, filters, and formats retrieved document chunks into a structured
evidence context bounded by model token limits.
"""

from typing import Dict, List, Optional

from app.core.config import Settings, get_settings
from app.services.extractors.base import estimate_token_count
from app.services.rag.models import AssembledContext
from app.services.retrieval.models import SearchResultItem


class ContextBuilder:
    """Assembles and formats retrieved chunks into an LLM context block."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.max_tokens = getattr(self.settings, "RAG_MAX_CONTEXT_TOKENS", 3000)
        self.min_relevance_score = getattr(self.settings, "RAG_MIN_RELEVANCE_SCORE", 0.0)

    def build_context(
        self,
        retrieved_chunks: List[SearchResultItem],
        max_tokens: Optional[int] = None,
    ) -> AssembledContext:
        """Filter, deduplicate, and compile chunks into an evidence block with source tags."""
        budget = max_tokens or self.max_tokens
        selected_chunks: List[SearchResultItem] = []
        sources_map: Dict[int, SearchResultItem] = {}
        seen_chunk_ids = set()
        total_tokens = 0
        blocks: List[str] = []

        source_idx = 1
        for chunk in retrieved_chunks:
            # Skip duplicates
            if chunk.chunk_id in seen_chunk_ids:
                continue

            # Skip below minimum score threshold
            if chunk.score < self.min_relevance_score:
                continue

            chunk_tokens = estimate_token_count(chunk.content)
            # Stop if adding this chunk would exceed token budget (allowing at least 1 chunk)
            if selected_chunks and (total_tokens + chunk_tokens > budget):
                break

            seen_chunk_ids.add(chunk.chunk_id)
            selected_chunks.append(chunk)
            sources_map[source_idx] = chunk

            header = f"[Source {source_idx}] Document: {chunk.document_filename} | Page {chunk.page_number} | Chunk ID: {chunk.chunk_id}"
            if chunk.section_title:
                header += f" | Section: {chunk.section_title}"

            block = f"{header}\n{chunk.content.strip()}"
            blocks.append(block)

            total_tokens += chunk_tokens + 25  # Accounting for header tokens
            source_idx += 1

        context_text = "\n\n---\n\n".join(blocks) if blocks else ""

        return AssembledContext(
            context_text=context_text,
            chunks=selected_chunks,
            total_tokens=total_tokens,
            sources_map=sources_map,
        )
