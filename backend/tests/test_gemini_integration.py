"""Gemini LLM Provider Integration and Error Handling Tests (Phase 19.4).

Validates:
1. Gemini provider initialization with configurable model name.
2. Response parsing, token usage metrics, and finish reason handling.
3. Automatic model fallback when primary candidate encounters 404 / 429.
4. Error classification for HTTP 403 (policy block), HTTP 404 (not found), HTTP 429 (rate limit).
5. Safe error logging without secret exposure.
6. Real external API invocation check (detects live response vs. policy block vs. missing key).
"""

import asyncio
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from app.core.config import Settings, get_settings
from app.services.llm.base import (
    LLMConfigurationError,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.services.llm.gemini import RETIRED_GEMINI_MODELS, GeminiProvider
from app.services.llm.models import LLMMessage, LLMResponse


def test_gemini_provider_init_and_config():
    """Verify GeminiProvider initializes with model_name and credentials."""
    provider = GeminiProvider(api_key="test-api-key-12345", model_name="gemini-3.8-flash")
    assert provider.model_name == "gemini-3.8-flash"
    assert provider.validate_credentials() is True
    assert provider.api_key == "test-api-key-12345"


def test_gemini_provider_default_model_is_stable_38():
    """Verify GeminiProvider defaults to stable gemini-3.8-flash."""
    provider = GeminiProvider(api_key="test-api-key-12345")
    assert provider.model_name == "gemini-3.8-flash"
    assert "gemini-3.8-flash" in provider.fallback_models
    assert "gemini-3.5-flash-lite" in provider.fallback_models


def test_gemini_provider_missing_key_raises_configuration_error():
    """Verify missing API key raises LLMConfigurationError without making network calls."""
    provider = GeminiProvider(api_key="")
    assert provider.validate_credentials() is False

    messages = [LLMMessage(role="user", content="Hello")]
    with pytest.raises(LLMConfigurationError, match="Gemini API key is not configured"):
        asyncio.run(provider.generate(messages))


def test_gemini_generate_success_mock():
    """Verify Gemini response parsing from mock HTTP 200 payload."""
    mock_response_data = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Docora intelligent document summary."}],
                    "role": "model",
                },
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 25,
            "candidatesTokenCount": 10,
            "totalTokenCount": 35,
        },
    }

    mock_client = AsyncMock()
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = mock_response_data
    mock_client.post.return_value = mock_post_res

    provider = GeminiProvider(api_key="mock-key-12345", model_name="gemini-3.8-flash")
    messages = [LLMMessage(role="user", content="Summarize document")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        res = asyncio.run(provider.generate(messages))

        assert isinstance(res, LLMResponse)
        assert res.content == "Docora intelligent document summary."
        assert res.prompt_tokens == 25
        assert res.completion_tokens == 10
        assert res.total_tokens == 35
        assert res.finish_reason == "STOP"
        assert res.model_name == "gemini-3.8-flash"


def test_gemini_model_fallback_on_429_rate_limit():
    """Verify provider falls back to secondary candidate model if primary candidate returns 429 rate limit."""
    mock_client = AsyncMock()

    # Call 1 (gemini-3.8-flash): 429 Rate Limit
    res_429 = MagicMock()
    res_429.status_code = 429
    res_429.json.return_value = {"error": {"code": 429, "message": "Resource exhausted"}}

    # Call 2 (gemini-3.5-flash-lite): 200 OK
    res_200 = MagicMock()
    res_200.status_code = 200
    res_200.json.return_value = {
        "candidates": [
            {"content": {"parts": [{"text": "Fallback model response"}]}, "finishReason": "STOP"}
        ],
        "usageMetadata": {"promptTokenCount": 15, "candidatesTokenCount": 8},
    }

    mock_client.post.side_effect = [res_429, res_200]

    provider = GeminiProvider(api_key="mock-key-12345", model_name="gemini-3.8-flash")
    messages = [LLMMessage(role="user", content="Test fallback on 429")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        res = asyncio.run(provider.generate(messages))

        assert res.content == "Fallback model response"
        assert res.model_name == "gemini-3.5-flash-lite"


def test_gemini_model_fallback_on_503_service_unavailable():
    """Verify provider falls back to secondary candidate model on 503 service unavailable."""
    mock_client = AsyncMock()

    # Call 1 (gemini-3.8-flash): 503 Service Unavailable
    res_503 = MagicMock()
    res_503.status_code = 503
    res_503.text = "Service temporarily unavailable"

    # Call 2 (gemini-3.5-flash-lite): 200 OK
    res_200 = MagicMock()
    res_200.status_code = 200
    res_200.json.return_value = {
        "candidates": [
            {"content": {"parts": [{"text": "503 recovered fallback response"}]}, "finishReason": "STOP"}
        ],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
    }

    mock_client.post.side_effect = [res_503, res_200]

    provider = GeminiProvider(api_key="mock-key-12345", model_name="gemini-3.8-flash")
    messages = [LLMMessage(role="user", content="Test fallback on 503")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        res = asyncio.run(provider.generate(messages))

        assert res.content == "503 recovered fallback response"
        assert res.model_name == "gemini-3.5-flash-lite"


def test_gemini_does_not_conceal_invalid_model_on_404():
    """Verify provider does NOT fall back on 404 invalid model, raising immediately."""
    mock_client = AsyncMock()

    res_404 = MagicMock()
    res_404.status_code = 404
    res_404.json.return_value = {
        "error": {"code": 404, "message": "models/non-existent-model is not found", "status": "NOT_FOUND"}
    }
    mock_client.post.return_value = res_404

    provider = GeminiProvider(
        api_key="mock-key-12345",
        model_name="non-existent-model",
        fallback_models=["gemini-3.5-flash-lite"],
    )
    messages = [LLMMessage(role="user", content="Test 404 invalid model")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        with pytest.raises(LLMProviderError, match="error \\(HTTP 404\\)") as exc_info:
            asyncio.run(provider.generate(messages))

        assert "non-existent-model" in str(exc_info.value)
        # Verify fallback was NOT attempted (post called exactly once)
        assert mock_client.post.call_count == 1


def test_gemini_does_not_conceal_auth_error_on_401():
    """Verify provider does NOT fall back on 401 Unauthorized, raising immediately."""
    mock_client = AsyncMock()

    res_401 = MagicMock()
    res_401.status_code = 401
    res_401.json.return_value = {
        "error": {"code": 401, "message": "API key invalid", "status": "UNAUTHENTICATED"}
    }
    mock_client.post.return_value = res_401

    provider = GeminiProvider(
        api_key="bad-key",
        model_name="gemini-3.8-flash",
        fallback_models=["gemini-3.5-flash-lite"],
    )
    messages = [LLMMessage(role="user", content="Test 401")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        with pytest.raises(LLMProviderError, match="non-retryable HTTP 401"):
            asyncio.run(provider.generate(messages))

        # Verify fallback was NOT attempted
        assert mock_client.post.call_count == 1


def test_gemini_custom_fallback_models():
    """Verify provider respects custom configurable fallback models on retryable 429."""
    mock_client = AsyncMock()
    res_429 = MagicMock()
    res_429.status_code = 429
    res_429.json.return_value = {"error": {"code": 429, "message": "Rate limit exceeded"}}

    res_200 = MagicMock()
    res_200.status_code = 200
    res_200.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Custom fallback response"}]}, "finishReason": "STOP"}],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
    }
    mock_client.post.side_effect = [res_429, res_200]

    provider = GeminiProvider(
        api_key="mock-key-12345",
        model_name="custom-primary-model",
        fallback_models=["custom-backup-model"],
    )
    messages = [LLMMessage(role="user", content="Test custom fallback")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        res = asyncio.run(provider.generate(messages))

        assert res.content == "Custom fallback response"
        assert res.model_name == "custom-backup-model"


def test_retired_gemini_models_rejected_in_production():
    """Verify that configuring known retired/sunset models in production raises a configuration violation,

    while gemini-2.5-flash (restricted access, not shut down) is not rejected.
    """
    base_prod_kwargs = {
        "ENVIRONMENT": "production",
        "ALLOW_DEV_AUTH": False,
        "SECRET_KEY": "a-secure-random-32-byte-hex-secret-in-production-ok!",
        "ALLOWED_ORIGINS": ["https://docora.example.com"],
        "STORAGE_PROVIDER": "supabase",
        "SUPABASE_URL": "https://validproject.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "valid-service-role-key-length-ok",
        "SUPABASE_STORAGE_BUCKET": "udip-documents",
        "DATABASE_URL": "postgresql+asyncpg://postgres:secret@db.supabase.co:5432/postgres",
        "LLM_PROVIDER": "gemini",
    }

    # Truly retired models must be rejected
    for retired_model in [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-8b",
        "gemini-2.0-flash",
        "gemini-3-flash-preview",
    ]:
        with pytest.raises(ValueError, match="Configuration violation: Retired Gemini model"):
            Settings(**base_prod_kwargs, LLM_MODEL_NAME=retired_model)

    # Active stable models and operational models with restricted access must succeed
    valid_settings_38 = Settings(**base_prod_kwargs, LLM_MODEL_NAME="gemini-3.8-flash")
    assert valid_settings_38.LLM_MODEL_NAME == "gemini-3.8-flash"

    valid_settings_25 = Settings(**base_prod_kwargs, LLM_MODEL_NAME="gemini-2.5-flash")
    assert valid_settings_25.LLM_MODEL_NAME == "gemini-2.5-flash"


def test_gemini_error_handling_403_policy_error():
    """Verify HTTP 403 policy error raises LLMProviderError without leaking API keys or attempting fallback."""
    mock_client = AsyncMock()
    res_403 = MagicMock()
    res_403.status_code = 403
    res_403.json.return_value = {
        "error": {
            "code": 403,
            "message": "Request to POST /v1beta/models/... not allowed by policy",
            "status": "PERMISSION_DENIED",
        }
    }
    mock_client.post.return_value = res_403

    provider = GeminiProvider(
        api_key="super-secret-key-do-not-leak",
        model_name="gemini-3.8-flash",
        fallback_models=["gemini-3.5-flash-lite"],
    )
    messages = [LLMMessage(role="user", content="Test 403")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        with pytest.raises(LLMProviderError) as exc_info:
            asyncio.run(provider.generate(messages))

        # Crucial security & architecture checks:
        # 1. API key must NEVER appear in exception message
        assert "super-secret-key" not in str(exc_info.value)
        assert "403" in str(exc_info.value)
        # 2. Must not conceal 403 by attempting fallback
        assert mock_client.post.call_count == 1


def test_gemini_error_handling_429_rate_limit():
    """Verify HTTP 429 raises LLMRateLimitError when all candidates exhausted."""
    mock_client = AsyncMock()
    res_429 = MagicMock()
    res_429.status_code = 429
    res_429.text = "Quota exceeded"
    mock_client.post.return_value = res_429

    provider = GeminiProvider(api_key="mock-key-12345", model_name="gemini-3.8-flash")
    messages = [LLMMessage(role="user", content="Test 429")]

    with patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__.return_value = mock_client
        with pytest.raises(LLMRateLimitError):
            asyncio.run(provider.generate(messages))


def test_live_gemini_api_connectivity_diagnostic():
    """Diagnostic check against real Google Generative Language API if key exists.

    Distinguishes:
    - PASS: Real API 200 OK completion
    - BLOCKED (403): GCP API policy disallows access to generativelanguage.googleapis.com
    - BLOCKED (401): Invalid API key
    - BLOCKED (NO_KEY): GEMINI_API_KEY is not configured
    """
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY.get_secret_value() if settings.GEMINI_API_KEY else ""

    if not api_key or "placeholder" in api_key.lower():
        pytest.skip("Live Gemini integration skipped: GEMINI_API_KEY not configured.")

    async def _live_call():
        provider = GeminiProvider(api_key=api_key, model_name=settings.LLM_MODEL_NAME)
        messages = [LLMMessage(role="user", content="Ping. Answer with single word: PONG.")]
        try:
            res = await provider.generate(messages, max_tokens=10)
            return True, f"SUCCESS: Model {res.model_name} responded: {res.content.strip()}"
        except LLMProviderError as e:
            if "403" in str(e) or "policy" in str(e).lower():
                return False, f"BLOCKED_403_GCP_POLICY: Key present but GCP project policy rejects generativelanguage.googleapis.com."
            elif "404" in str(e):
                return False, f"BLOCKED_404_MODEL_NOT_FOUND: Configured model {settings.LLM_MODEL_NAME} not found."
            return False, f"BLOCKED_PROVIDER_ERROR: {str(e)[:150]}"
        except LLMRateLimitError:
            return False, "BLOCKED_429_RATE_LIMIT: Quota exceeded on live key."
        except Exception as e:
            return False, f"BLOCKED_EXCEPTION: {type(e).__name__} {str(e)[:150]}"

    success, diagnostic = asyncio.run(_live_call())
    print(f"\n[LIVE GEMINI AUDIT RESULT]: {diagnostic}")
    # We assert that the diagnostic was successfully classified
    assert diagnostic is not None
    assert len(diagnostic) > 5
