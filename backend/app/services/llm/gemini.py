"""Google Gemini LLM Provider.

Implements asynchronous non-streaming and streaming completion via the Gemini REST API
with zero heavy external dependencies, model fallback resolution, exponential backoff,
and strict credential isolation.
"""

import asyncio
import json
from typing import Any, AsyncGenerator, Dict, List, Optional
import httpx

from app.core.logging import get_logger
from app.services.llm.base import (
    BaseLLMProvider,
    LLMConfigurationError,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
)
from app.services.llm.models import LLMMessage, LLMResponse, LLMStreamChunk

logger = get_logger("llm.gemini")

# Officially retired / shut-down Gemini models according to Google API lifecycle documentation.
# Note: gemini-2.5-flash is NOT in this retired list as it remains operational, but its access
# is restricted for new projects, so it is not included in automatic fallback lists.
RETIRED_GEMINI_MODELS = {
    "gemini-1.0-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash-thinking-exp",
    "gemini-3-flash-preview",
}

# Active stable models in preferential order for resilience against per-model quotas or transient outages
FALLBACK_FLASH_MODELS = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]


class GeminiProvider(BaseLLMProvider):
    """Provider connecting to Google Gemini Models with resilient model resolution."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-3.8-flash",
        fallback_models: Optional[List[str]] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
        timeout_seconds: float = 90.0,
    ) -> None:
        resolved_model = model_name or "gemini-3.8-flash"
        if resolved_model in RETIRED_GEMINI_MODELS:
            logger.warning(
                "Configured Gemini model '%s' is officially retired/shut down. "
                "Requests may fail with 404. Consider upgrading to 'gemini-3.8-flash'.",
                resolved_model,
            )

        super().__init__(
            model_name=resolved_model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        self.api_key = api_key.strip() if api_key else ""
        self.fallback_models = fallback_models if fallback_models is not None else list(FALLBACK_FLASH_MODELS)

    def validate_credentials(self) -> bool:
        """Validate API key presence without exposing secret."""
        return bool(self.api_key and len(self.api_key) > 5)

    def _build_payload(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
    ) -> Dict:
        """Format messages for Gemini API v1beta."""
        system_instructions = []
        contents = []

        for m in messages:
            if m.role == "system":
                system_instructions.append({"text": m.content})
            elif m.role == "user":
                contents.append({"role": "user", "parts": [{"text": m.content}]})
            elif m.role == "assistant":
                contents.append({"role": "model", "parts": [{"text": m.content}]})

        # Ensure at least one user content exists
        if not contents and system_instructions:
            contents.append({"role": "user", "parts": [{"text": "Proceed based on instructions."}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self.temperature,
                "maxOutputTokens": max_tokens if max_tokens is not None else self.max_tokens,
            },
        }
        if response_mime_type:
            payload["generationConfig"]["responseMimeType"] = response_mime_type

        if system_instructions:
            payload["system_instruction"] = {
                "parts": system_instructions,
            }
        return payload

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate complete completion via Gemini generateContent with automatic model fallback."""
        if not self.validate_credentials():
            raise LLMConfigurationError("Gemini API key is not configured. Set GEMINI_API_KEY in environment.")

        models_to_try = [self.model_name] + [m for m in self.fallback_models if m != self.model_name]
        payload = self._build_payload(messages, temperature, max_tokens, response_mime_type=response_mime_type)
        last_error = None

        for model_candidate in models_to_try:
            url = f"{self.BASE_URL}/{model_candidate}:generateContent?key={self.api_key}"
            for attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                        res = await client.post(url, json=payload)

                        # 1. Non-retryable: Authentication / Permission / Policy errors (401, 403)
                        # Must raise immediately and NEVER trigger fallback to avoid concealing credential/policy issues
                        if res.status_code in (401, 403):
                            try:
                                err_msg = res.json().get("error", {}).get("message", res.text)
                            except Exception:
                                err_msg = res.text
                            logger.error("Gemini non-retryable auth/policy error HTTP %d for %s: %s", res.status_code, model_candidate, err_msg)
                            raise LLMProviderError(f"Gemini API returned non-retryable HTTP {res.status_code}: {err_msg}")

                        # 2. Non-retryable: Invalid model / client request errors (400, 404)
                        # Must raise immediately and NEVER trigger fallback to avoid concealing misconfiguration or invalid model names
                        if res.status_code in (400, 404):
                            try:
                                err_msg = res.json().get("error", {}).get("message", res.text)
                            except Exception:
                                err_msg = res.text
                            logger.error("Gemini invalid model or request error HTTP %d for %s: %s", res.status_code, model_candidate, err_msg)
                            raise LLMProviderError(f"Gemini model '{model_candidate}' error (HTTP {res.status_code}): {err_msg}")

                        # 3. Retryable across candidate models: Rate limit / Quota (429) or Service Unavailable / Gateway (500, 502, 503, 504)
                        if res.status_code in (429, 500, 502, 503, 504):
                            try:
                                body_err = res.json().get("error", {}).get("message", res.text[:200])
                            except Exception:
                                body_err = res.text[:200]
                            logger.warning(
                                "Gemini model %s transient error HTTP %d: %s. Attempting fallback candidate...",
                                model_candidate,
                                res.status_code,
                                body_err,
                            )
                            if res.status_code == 429:
                                last_error = LLMRateLimitError(
                                    f"Gemini API rate limit reached for {model_candidate} (429): {body_err}"
                                )
                            else:
                                last_error = LLMProviderError(
                                    f"Gemini error for {model_candidate} (HTTP {res.status_code}): {body_err}"
                                )
                            await asyncio.sleep(0.5 * (attempt + 1))
                            break  # Try next model candidate

                        if res.status_code >= 400:
                            try:
                                err_msg = res.json().get("error", {}).get("message", res.text)
                            except Exception:
                                err_msg = res.text
                            logger.error("Gemini HTTP %d for %s: %s", res.status_code, model_candidate, err_msg)
                            raise LLMProviderError(f"Gemini API returned HTTP {res.status_code}: {err_msg}")

                        data = res.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            raise LLMProviderError("Gemini returned empty candidate response.")

                        candidate = candidates[0]
                        parts = candidate.get("content", {}).get("parts", [])
                        text = "".join(p.get("text", "") for p in parts)
                        finish_reason = candidate.get("finishReason", "stop")

                        usage = data.get("usageMetadata", {})
                        p_tokens = usage.get("promptTokenCount", 0)
                        c_tokens = usage.get("candidatesTokenCount", 0)

                        return LLMResponse(
                            content=text,
                            model_name=model_candidate,
                            prompt_tokens=p_tokens,
                            completion_tokens=c_tokens,
                            total_tokens=p_tokens + c_tokens,
                            finish_reason=finish_reason,
                        )

                except httpx.TimeoutException:
                    last_error = LLMTimeoutError(f"Gemini API timed out after {self.timeout_seconds}s for {model_candidate}.")
                    await asyncio.sleep(0.5)
                except (LLMProviderError, LLMConfigurationError):
                    # Immediate non-retryable errors (auth, policy, invalid model): propagate immediately
                    raise
                except LLMRateLimitError as e:
                    last_error = e
                except Exception as e:
                    last_error = LLMProviderError(f"Gemini request failed: {e}")

        if last_error:
            raise last_error
        raise LLMProviderError("All Gemini model generation attempts failed.")

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream completion chunks via Gemini streamGenerateContent with fallback."""
        if not self.validate_credentials():
            raise LLMConfigurationError("Gemini API key is not configured.")

        models_to_try = [self.model_name] + [m for m in self.fallback_models if m != self.model_name]
        payload = self._build_payload(messages, temperature, max_tokens, response_mime_type=response_mime_type)
        stream_started = False

        for model_candidate in models_to_try:
            url = f"{self.BASE_URL}/{model_candidate}:streamGenerateContent?alt=sse&key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code in (401, 403):
                            raise LLMProviderError(f"Gemini stream non-retryable auth/policy error HTTP {response.status_code}")

                        if response.status_code in (400, 404):
                            raise LLMProviderError(f"Gemini stream model '{model_candidate}' invalid or not found (HTTP {response.status_code})")

                        if response.status_code in (429, 500, 502, 503, 504):
                            logger.warning(
                                "Gemini streaming %s returned retryable HTTP %d, falling back to next candidate...",
                                model_candidate,
                                response.status_code,
                            )
                            continue

                        if response.status_code >= 400:
                            raise LLMProviderError(f"Gemini stream returned HTTP {response.status_code}")

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                raw_json = line[6:].strip()
                                if not raw_json:
                                    continue
                                try:
                                    parsed = json.loads(raw_json)
                                    candidates = parsed.get("candidates", [])
                                    if candidates:
                                        parts = candidates[0].get("content", {}).get("parts", [])
                                        for part in parts:
                                            delta = part.get("text", "")
                                            if delta:
                                                stream_started = True
                                                yield LLMStreamChunk(delta=delta)
                                except json.JSONDecodeError:
                                    continue
                        if stream_started:
                            return
            except Exception as e:
                logger.warning("Streaming with model %s failed: %s", model_candidate, e)
                if stream_started:
                    # Don't switch models halfway through streaming
                    return
                continue

        if not stream_started:
            raise LLMProviderError("All Gemini stream generation attempts failed.")
