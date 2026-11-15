"""Base LLM Provider Interface and Custom Exceptions.

Defines the contract for language model providers, token generators, and error handling.
"""

from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, List, Optional

from app.core.exceptions import UDIPException
from app.services.llm.models import LLMMessage, LLMResponse, LLMStreamChunk


class LLMProviderError(UDIPException):
    """Base exception for errors originating from LLM providers."""

    def __init__(self, message: str, status_code: int = 502, error_code: str = "LLM_PROVIDER_ERROR", details: dict | None = None) -> None:
        super().__init__(
            message=message,
            status_code=status_code,
            error_code=error_code,
            details=details,
        )


class LLMConfigurationError(LLMProviderError):
    """Raised when an LLM provider is missing required API keys or invalid endpoints."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(
            message=message,
            status_code=500,
            error_code="LLM_CONFIGURATION_ERROR",
            details=details,
        )


class LLMRateLimitError(LLMProviderError):
    """Raised when an LLM provider quota or rate limit is reached."""

    def __init__(self, message: str = "LLM provider rate limit exceeded. Please retry shortly.", details: dict | None = None) -> None:
        super().__init__(
            message=message,
            status_code=429,
            error_code="LLM_RATE_LIMIT_EXCEEDED",
            details=details,
        )


class LLMTimeoutError(LLMProviderError):
    """Raised when an LLM provider request times out."""

    def __init__(self, message: str = "LLM provider request timed out.", details: dict | None = None) -> None:
        super().__init__(
            message=message,
            status_code=504,
            error_code="LLM_TIMEOUT",
            details=details,
        )


class BaseLLMProvider(ABC):
    """Abstract base class for all language model providers."""

    def __init__(
        self,
        model_name: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        timeout_seconds: float = 90.0,
    ) -> None:
        self.model_name = model_name
        self.temperature = max(0.0, min(temperature, 2.0))
        self.max_tokens = max(1, max_tokens)
        self.timeout_seconds = max(1.0, timeout_seconds)

    @abstractmethod
    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a complete text completion asynchronously."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream generated text chunks asynchronously."""
        pass

    @abstractmethod
    def validate_credentials(self) -> bool:
        """Verify whether required API keys or endpoints are configured."""
        pass
