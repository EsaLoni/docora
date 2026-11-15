"""OpenAI-Compatible & Local LLM Provider (Ollama / LocalAI / vLLM).

Supports standard /chat/completions REST interfaces with streaming SSE support.
"""

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

logger = get_logger("llm.openai_compatible")


class OpenAICompatibleProvider(BaseLLMProvider):
    """Provider connecting to OpenAI-compatible endpoints including local Ollama."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        api_key: str = "",
        model_name: str = "llama3.2:1b",
        temperature: float = 0.1,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> None:
        super().__init__(
            model_name=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip() if api_key else ""

    def validate_credentials(self) -> bool:
        """Validate base URL is present."""
        return bool(self.base_url and self.base_url.startswith("http"))

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Execute chat completion via /chat/completions."""
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": [m.model_dump() for m in messages],
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.max_tokens,
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, json=payload, headers=self._headers())

                if res.status_code == 429:
                    raise LLMRateLimitError("Provider rate limit reached (429).")
                if res.status_code >= 400:
                    raise LLMProviderError(f"Provider returned HTTP {res.status_code}: {res.text}")

                data = res.json()
                choice = data.get("choices", [{}])[0]
                text = choice.get("message", {}).get("content", "")
                finish = choice.get("finish_reason", "stop")
                usage = data.get("usage", {})

                return LLMResponse(
                    content=text,
                    model_name=self.model_name,
                    prompt_tokens=usage.get("prompt_tokens", 0),
                    completion_tokens=usage.get("completion_tokens", 0),
                    total_tokens=usage.get("total_tokens", 0),
                    finish_reason=finish,
                )
        except httpx.TimeoutException:
            raise LLMTimeoutError(f"Endpoint {self.base_url} timed out after {self.timeout_seconds}s.")
        except (LLMProviderError, LLMRateLimitError, LLMTimeoutError):
            raise
        except Exception as e:
            raise LLMProviderError(f"Request failed: {e}")

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Stream chat completion via SSE."""
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": [m.model_dump() for m in messages],
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.max_tokens,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                async with client.stream("POST", url, json=payload, headers=self._headers()) as response:
                    if response.status_code == 429:
                        raise LLMRateLimitError("Rate limit exceeded.")
                    if response.status_code >= 400:
                        raise LLMProviderError(f"Stream returned HTTP {response.status_code}")

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw = line[6:].strip()
                            if raw == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(raw)
                                delta = chunk_json.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    yield LLMStreamChunk(delta=delta)
                            except Exception:
                                continue

            yield LLMStreamChunk(delta="", finish_reason="stop")
        except httpx.TimeoutException:
            raise LLMTimeoutError("Streaming request timed out.")
