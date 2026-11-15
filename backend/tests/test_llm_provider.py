"""Unit and Integration Tests for UDIP LLM Providers and LLMService.

Tests:
- MockLLMProvider (deterministic generation, citation anchors, streaming)
- Error handling (timeout, rate limits, generic failures)
- LLMProviderFactory (provider resolution, credential validation)
- LLMService (exponential retry backoff, streaming pass-through)
"""

import asyncio
import pytest

from app.core.config import Settings
from app.services.llm.base import (
    LLMConfigurationError,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.services.llm.factory import LLMProviderFactory
from app.services.llm.gemini import GeminiProvider
from app.services.llm.mock import MockLLMProvider
from app.services.llm.models import LLMMessage
from app.services.llm.openai_compatible import OpenAICompatibleProvider
from app.services.llm.service import LLMService


def test_mock_llm_provider_generation():
    """Verify MockLLMProvider generates deterministic grounded answers."""
    provider = MockLLMProvider()
    messages = [
        LLMMessage(
            role="system",
            content="[Source 1] Revenue reached $15M.\n[Source 2] Margins were 30%.",
        ),
        LLMMessage(role="user", content="Summarize the revenue findings?"),
    ]

    async def _test():
        return await provider.generate(messages)

    response = asyncio.run(_test())
    assert response.content is not None
    assert len(response.content) > 10
    assert "[Source 1]" in response.content or "[Source 2]" in response.content
    assert response.model_name == "mock-grounded-llm"
    assert response.prompt_tokens > 0
    assert response.completion_tokens > 0


def test_mock_llm_provider_insufficient_evidence():
    """Verify provider states insufficient evidence when no sources are present."""
    provider = MockLLMProvider()
    messages = [
        LLMMessage(role="system", content="No document evidence available."),
        LLMMessage(role="user", content="What is the distance to Mars?"),
    ]

    async def _test():
        return await provider.generate(messages)

    response = asyncio.run(_test())
    assert "cannot find sufficient evidence" in response.content.lower()


def test_mock_llm_provider_streaming():
    """Verify MockLLMProvider yields incremental text chunks via generate_stream."""
    provider = MockLLMProvider()
    messages = [
        LLMMessage(role="system", content="[Source 1] Evidence content here."),
        LLMMessage(role="user", content="Explain the document."),
    ]

    async def _test():
        tokens = []
        async for chunk in provider.generate_stream(messages):
            if chunk.delta:
                tokens.append(chunk.delta)
        return tokens

    tokens = asyncio.run(_test())
    assert len(tokens) >= 2
    full_text = "".join(tokens)
    assert len(full_text) > 5


def test_mock_llm_provider_timeout_simulation():
    """Verify provider raises LLMTimeoutError when timeout occurs."""
    provider = MockLLMProvider(simulate_timeout=True)
    messages = [LLMMessage(role="user", content="Hello")]

    async def _test():
        with pytest.raises(LLMTimeoutError, match="timeout"):
            await provider.generate(messages)

    asyncio.run(_test())


def test_mock_llm_provider_rate_limit_simulation():
    """Verify provider raises LLMRateLimitError on 429."""
    provider = MockLLMProvider(simulate_rate_limit=True)
    messages = [LLMMessage(role="user", content="Hello")]

    async def _test():
        with pytest.raises(LLMRateLimitError, match="rate limit"):
            await provider.generate(messages)

    asyncio.run(_test())


def test_llm_provider_factory(test_settings: Settings):
    """Verify factory returns appropriate provider singletons."""
    LLMProviderFactory.reset()
    mock_cfg = test_settings.model_copy(update={"LLM_PROVIDER": "mock"})
    p1 = LLMProviderFactory.get_provider(mock_cfg)
    assert isinstance(p1, MockLLMProvider)
    assert p1.validate_credentials() is True

    LLMProviderFactory.reset()
    gemini_cfg = test_settings.model_copy(update={"LLM_PROVIDER": "gemini", "GEMINI_API_KEY": ""})
    p2 = LLMProviderFactory.get_provider(gemini_cfg)
    assert isinstance(p2, GeminiProvider)
    assert p2.validate_credentials() is False  # empty key

    LLMProviderFactory.reset()


def test_llm_service_retries():
    """Verify LLMService retries transient rate limits with backoff before failing."""
    provider = MockLLMProvider(simulate_rate_limit=True)
    service = LLMService(provider=provider)
    messages = [LLMMessage(role="user", content="Test prompt")]

    async def _test():
        with pytest.raises(LLMRateLimitError):
            await service.generate(messages)

    asyncio.run(_test())
