"""Search and Retrieval Data Models.

Defines search request parameters, ranked search result items,
and structured search responses.
"""

from typing import Any, Dict, List, Literal, Optional
import uuid
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """User search query parameters."""

    query: str = Field(..., min_length=1, max_length=1000, description="Search query text")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of results to return")
    mode: Literal["hybrid", "vector", "keyword"] = Field(
        default="hybrid",
        description="Search retrieval algorithm mode",
    )
    document_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional filter by specific document",
    )
    folder_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional filter by specific folder",
    )


class SearchResultItem(BaseModel):
    """An individual ranked search result citation."""

    chunk_id: str
    document_id: str
    document_filename: str
    document_title: str
    page_number: int
    content: str
    section_title: Optional[str] = None
    score: float
    retrieval_mode: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Search response container returned to API clients."""

    query: str
    mode: str
    total_results: int
    workspace_id: str
    results: List[SearchResultItem]
