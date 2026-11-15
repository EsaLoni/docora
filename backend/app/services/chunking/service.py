"""Unified Document Chunking Service.

Orchestrates page-level chunking across document pages, ensuring stable indexing,
table integrity, deduplication, and token validation.
"""

from typing import List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models.document import DocumentPage
from app.services.chunking.base import BaseChunker
from app.services.chunking.models import DocumentChunkResult
from app.services.chunking.table import TableAwareChunker

logger = get_logger("services.chunking")


class ChunkingService:
    """Service managing chunk generation across multi-page documents."""

    def __init__(
        self,
        chunker: Optional[BaseChunker] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.chunker = chunker or TableAwareChunker(
            chunk_size_tokens=self.settings.CHUNK_SIZE_TOKENS,
            chunk_overlap_tokens=self.settings.CHUNK_OVERLAP_TOKENS,
        )

    def chunk_document_pages(
        self,
        pages: List[DocumentPage],
        workspace_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> List[DocumentChunkResult]:
        """Split all pages of a document into ordered, validated chunks."""
        all_chunks: List[DocumentChunkResult] = []
        global_index = 0

        # Sort pages strictly by page number
        sorted_pages = sorted(pages, key=lambda p: p.page_number)

        for page in sorted_pages:
            if not page.content or not page.content.strip():
                continue

            page_chunks = self.chunker.chunk_page(
                page_content=page.content,
                page_number=page.page_number,
                page_id=page.id,
                document_id=document_id,
                workspace_id=workspace_id,
                page_metadata=page.metadata_json,
                start_index=global_index,
            )

            for chunk in page_chunks:
                # Discard zero-content chunks
                if not chunk.content or not chunk.content.strip():
                    continue

                all_chunks.append(chunk)
                global_index += 1

        logger.info(
            "Generated %d chunks across %d pages for document %s",
            len(all_chunks), len(pages), document_id,
        )
        return all_chunks
