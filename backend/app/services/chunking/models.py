"""Chunk Data Models and Validation Utilities.

Standardized chunk representations preserving document-to-page lineage,
section titles, chunk types, token metrics, and metadata.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field

from app.services.extractors.base import estimate_token_count


class ChunkType(str, Enum):
    """Semantic type of content contained within a chunk."""

    TEXT = "text"
    TABLE = "table"
    HEADING = "heading"
    MIXED = "mixed"


class DocumentChunkResult(BaseModel):
    """Standardized representation of an individual text passage chunk."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    workspace_id: uuid.UUID
    document_id: uuid.UUID
    page_id: uuid.UUID
    page_number: int
    chunk_index: int
    content: str
    token_count: int = 0
    section_title: Optional[str] = None
    chunk_type: str = ChunkType.TEXT.value
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    def model_post_init(self, __context: Any) -> None:
        """Ensure token_count is populated if zero."""
        if self.token_count <= 0 and self.content:
            self.token_count = estimate_token_count(self.content)
