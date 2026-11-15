"""Answer Generator Engine.

Interfaces with the configured LLMService to produce non-streaming or streaming
answer completions.
"""

from typing import AsyncGenerator, List, Optional

from app.services.llm.models import LLMMessage, LLMResponse, LLMStreamChunk
from app.services.llm.service import LLMService


class AnswerGenerator:
    """Dispatches constructed prompts to the LLM service."""

    def __init__(self, llm_service: LLMService) -> None:
        self.llm_service = llm_service

    async def generate_answer(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMResponse:
        """Produce full answer text via LLMService."""
        return await self.llm_service.generate(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream answer tokens via LLMService."""
        async for chunk in self.llm_service.generate_stream(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield chunk
