"""LLM Provider Factory.

Instantiates and caches configured language model providers according to application settings.
"""

from typing import Optional

from app.core.config import Settings, get_settings
from app.services.llm.base import BaseLLMProvider
from app.services.llm.gemini import GeminiProvider
from app.services.llm.mock import MockLLMProvider
from app.services.llm.openai_compatible import OpenAICompatibleProvider


class LLMProviderFactory:
    """Factory resolving LLM provider singletons."""

    _instance: Optional[BaseLLMProvider] = None

    @classmethod
    def reset(cls) -> None:
        cls._instance = None

    @classmethod
    def get_provider(cls, settings: Optional[Settings] = None) -> BaseLLMProvider:
        """Return configured LLM provider instance."""
        if cls._instance is not None:
            return cls._instance

        cfg = settings or get_settings()
        provider_name = cfg.LLM_PROVIDER.lower().strip()

        def _resolve_secret(val) -> str:
            if hasattr(val, "get_secret_value"):
                return val.get_secret_value()
            return str(val or "")

        if provider_name == "gemini":
            gemini_raw = getattr(cfg, "GEMINI_API_KEY", None)
            if gemini_raw is not None and _resolve_secret(gemini_raw) == "":
                api_key = ""
            else:
                api_key = _resolve_secret(gemini_raw) or _resolve_secret(cfg.LLM_API_KEY)
            model = cfg.LLM_MODEL_NAME if "gemini" in cfg.LLM_MODEL_NAME else "gemini-3.8-flash"
            cls._instance = GeminiProvider(
                api_key=api_key,
                model_name=model,
                temperature=cfg.LLM_TEMPERATURE,
                max_tokens=cfg.LLM_MAX_TOKENS,
                timeout_seconds=getattr(cfg, "LLM_TIMEOUT_SECONDS", 90.0),
            )
        elif provider_name in ("ollama", "openai_compatible"):
            api_key = _resolve_secret(cfg.LLM_API_KEY)
            cls._instance = OpenAICompatibleProvider(
                base_url=cfg.LLM_BASE_URL,
                api_key=api_key,
                model_name=cfg.LLM_MODEL_NAME,
                temperature=cfg.LLM_TEMPERATURE,
                max_tokens=cfg.LLM_MAX_TOKENS,
                timeout_seconds=getattr(cfg, "LLM_TIMEOUT_SECONDS", 90.0),
            )
        else:
            # Default to deterministic mock provider
            cls._instance = MockLLMProvider(
                model_name="mock-grounded-llm",
                temperature=cfg.LLM_TEMPERATURE,
                max_tokens=cfg.LLM_MAX_TOKENS,
                timeout_seconds=getattr(cfg, "LLM_TIMEOUT_SECONDS", 90.0),
            )

        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset cached singleton instance (useful in tests)."""
        cls._instance = None
