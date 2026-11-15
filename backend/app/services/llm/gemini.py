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

# Active candidate flash models in preferential order for resilience against per-model quotas or deprecations
FALLBACK_FLASH_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.5-flash-lite",
]


class GeminiProvider(BaseLLMProvider):
    """Provider connecting to Google Gemini Models with resilient model resolution."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-3-flash-preview",
        temperature: float = 0.1,
        max_tokens: int = 2048,
        timeout_seconds: float = 90.0,
    ) -> None:
        # Default to high-availability gemini-3-flash-preview if old/invalid model name supplied
        resolved_model = model_name
        if not resolved_model or resolved_model in ("gemini-1.5-flash", "gemini-2.0-flash"):
            resolved_model = "gemini-3-flash-preview"

        super().__init__(
            model_name=resolved_model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        self.api_key = api_key.strip() if api_key else ""

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

        models_to_try = [self.model_name] + [m for m in FALLBACK_FLASH_MODELS if m != self.model_name]
        payload = self._build_payload(messages, temperature, max_tokens, response_mime_type=response_mime_type)
        last_error = None

        for model_candidate in models_to_try:
            url = f"{self.BASE_URL}/{model_candidate}:generateContent?key={self.api_key}"
            for attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                        res = await client.post(url, json=payload)

                        if res.status_code == 429:
                            logger.warning(
                                "Gemini model %s rate limit / quota exceeded (429). Attempting next model candidate...",
                                model_candidate,
                            )
                            last_error = LLMRateLimitError(
                                f"Gemini API rate limit reached for {model_candidate} (429)."
                            )
                            await asyncio.sleep(0.5 * (attempt + 1))
                            break  # Try next model candidate

                        if res.status_code == 404:
                            logger.warning(
                                "Gemini model %s not found or deprecated (404). Trying next model...",
                                model_candidate,
                            )
                            last_error = LLMProviderError(f"Gemini model {model_candidate} not available (404).")
                            break  # Try next model candidate

                        if res.status_code >= 400:
                            err_msg = res.json().get("error", {}).get("message", res.text)
                            logger.error("Gemini HTTP %d for %s: %s", res.status_code, model_candidate, err_msg)
                            last_error = LLMProviderError(f"Gemini API returned HTTP {res.status_code}: {err_msg}")
                            break

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
                    last_error = LLMTimeoutError(f"Gemini API timed out after {self.timeout_seconds}s.")
                    await asyncio.sleep(0.5)
                except (LLMProviderError, LLMRateLimitError, LLMTimeoutError, LLMConfigurationError) as e:
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

        models_to_try = [self.model_name] + [m for m in FALLBACK_FLASH_MODELS if m != self.model_name]
        payload = self._build_payload(messages, temperature, max_tokens, response_mime_type=response_mime_type)
        stream_started = False

        for model_candidate in models_to_try:
            url = f"{self.BASE_URL}/{model_candidate}:streamGenerateContent?alt=sse&key={self.api_key}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code in (404, 429):
                            logger.warning(
                                "Gemini streaming %s returned HTTP %d, falling back to next model...",
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
