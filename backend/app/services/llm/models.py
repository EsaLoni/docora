"""LLM Provider Data Models.

Defines standardized message formats, response containers, and streaming chunk tokens.
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    """Message item passed to an LLM provider."""

    role: Literal["system", "user", "assistant"] = Field(
        ...,
        description="Role of the message author",
    )
    content: str = Field(..., description="Message text content")


class LLMResponse(BaseModel):
    """Complete response returned by an LLM provider."""

    content: str = Field(..., description="Generated answer text")
    model_name: str = Field(..., description="Name of the model that generated the completion")
    prompt_tokens: int = Field(default=0, description="Estimated or reported prompt tokens")
    completion_tokens: int = Field(default=0, description="Estimated or reported completion tokens")
    total_tokens: int = Field(default=0, description="Total tokens consumed")
    finish_reason: str = Field(default="stop", description="Reason completion finished")


class LLMStreamChunk(BaseModel):
    """Incremental chunk emitted during streaming answer generation."""

    delta: str = Field(default="", description="Incremental text token or fragment")
    finish_reason: Optional[str] = Field(default=None, description="Completion finish reason if last chunk")
    token_count: Optional[int] = Field(default=None, description="Cumulative or estimated token count")
