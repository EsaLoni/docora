"""Base Chunker Interface.

Defines the contract for token-aware, page-scoped document chunkers.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import uuid

from app.services.chunking.models import DocumentChunkResult


class BaseChunker(ABC):
    """Abstract base class for all chunking implementations."""

    def __init__(self, chunk_size_tokens: int = 400, chunk_overlap_tokens: int = 50) -> None:
        self.chunk_size_tokens = max(50, chunk_size_tokens)
        self.chunk_overlap_tokens = max(0, min(chunk_overlap_tokens, self.chunk_size_tokens // 2))

    @abstractmethod
    def chunk_page(
        self,
        page_content: str,
        page_number: int,
        page_id: uuid.UUID,
        document_id: uuid.UUID,
        workspace_id: uuid.UUID,
        page_metadata: Optional[Dict[str, Any]] = None,
        start_index: int = 0,
    ) -> List[DocumentChunkResult]:
        """Split a page's content into structured chunks with preserved lineage.

        Args:
            page_content: Raw or formatted text of the page.
            page_number: Natural page/sheet number (1-based).
            page_id: Unique database primary key of the DocumentPage.
            document_id: Parent document UUID.
            workspace_id: Tenant workspace UUID.
            page_metadata: Optional extraction metadata (tables, rotation, sheet names).
            start_index: Global starting index for chunk ordering within document.

        Returns:
            List of structured DocumentChunkResult items.
        """
        pass
