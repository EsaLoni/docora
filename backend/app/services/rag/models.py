"""RAG Engine Data Models and DTOs.

Defines request options, citation representations, assembled context structures,
and structured RAG responses.
"""

from typing import Any, Dict, List, Literal, Optional
import uuid
from pydantic import BaseModel, Field

from app.services.retrieval.models import SearchResultItem


class CitationDTO(BaseModel):
    """Structured evidence citation referencing a persisted chunk."""

    id: Optional[str] = Field(default=None, description="Persisted citation UUID")
    document_id: str = Field(..., description="Parent document UUID")
    document_filename: str = Field(..., description="Document filename")
    chunk_id: str = Field(..., description="Referenced chunk UUID")
    page_number: int = Field(..., description="Document page number")
    quote: str = Field(..., description="Relevant source excerpt from chunk")
    relevance_score: Optional[float] = Field(default=None, description="Retrieval similarity score")
    citation_index: int = Field(default=1, description="Order of citation in response")


class AssembledContext(BaseModel):
    """Context assembled from retrieved chunks fitting within model token budgets."""

    context_text: str = Field(..., description="Formatted context string for LLM prompt")
    chunks: List[SearchResultItem] = Field(default_factory=list, description="Retrieved chunk items")
    total_tokens: int = Field(default=0, description="Estimated token count of assembled context")
    sources_map: Dict[int, SearchResultItem] = Field(
        default_factory=dict,
        description="Lookup mapping [Source N] integer index to chunk item",
    )


class RAGRequest(BaseModel):
    """User question and RAG generation parameters."""

    question: str = Field(..., min_length=1, max_length=2000, description="User question")
    conversation_id: Optional[uuid.UUID] = Field(default=None, description="Conversation thread UUID")
    selected_document_ids: Optional[List[uuid.UUID]] = Field(
        default=None,
        description="Optional filter restricting search to specific document UUIDs",
    )
    retrieval_mode: Literal["hybrid", "vector", "keyword"] = Field(
        default="hybrid",
        description="Search algorithm to retrieve context",
    )
    stream: bool = Field(default=False, description="Whether to stream response via SSE")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=4096)


class RAGResponse(BaseModel):
    """Complete grounded answer and citation payload."""

    answer: str = Field(..., description="Generated answer text")
    message_id: str = Field(..., description="Persisted assistant message UUID")
    conversation_id: str = Field(..., description="Conversation UUID")
    citations: List[CitationDTO] = Field(default_factory=list, description="Verified source citations")
    retrieval_metadata: Dict[str, Any] = Field(default_factory=dict, description="Diagnostics and retrieval stats")
    generation_status: str = Field(default="completed", description="Execution status ('completed', 'insufficient_evidence', 'failed')")
    processing_time_ms: float = Field(default=0.0, description="Total pipeline execution latency in milliseconds")
