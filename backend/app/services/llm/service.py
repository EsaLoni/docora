"""High-Level Language Model Service.

Manages LLM inference with exponential retry backoff, response validation,
timeout handling, and credential privacy.
"""

import asyncio
from typing import AsyncGenerator, List, Optional

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.llm.base import (
    BaseLLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.services.llm.factory import LLMProviderFactory
from app.services.llm.models import LLMMessage, LLMResponse, LLMStreamChunk

logger = get_logger("services.llm")


class LLMService:
    """Service wrapping language model execution with retries and safety policies."""

    MAX_RETRIES = 2

    def __init__(
        self,
        provider: Optional[BaseLLMProvider] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.provider = provider or LLMProviderFactory.get_provider(self.settings)

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMResponse:
        """Execute non-streaming completion with exponential retry backoff."""
        if not messages:
            raise ValueError("Message list cannot be empty.")

        last_error = None
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                response = await self.provider.generate(
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return response
            except (LLMRateLimitError, LLMTimeoutError) as e:
                last_error = e
                logger.warning(
                    "LLM transient failure on attempt %d/%d: %s",
                    attempt + 1, self.MAX_RETRIES + 1, e.message,
                )
                if attempt < self.MAX_RETRIES:
                    await asyncio.sleep(1.0 * (2 ** attempt))
            except Exception as e:
                # Non-retryable error
                logger.error("LLM non-retryable failure: %s", e)
                raise

        raise last_error or LLMProviderError("LLM generation failed after retries.")

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream completion tokens directly from the provider."""
        if not messages:
            raise ValueError("Message list cannot be empty.")

        async for chunk in self.provider.generate_stream(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield chunk
