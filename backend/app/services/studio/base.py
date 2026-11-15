"""Base Studio Service and Prompt Engineering Utilities.

Provides shared interfaces, citation extractors, and LLM dispatchers for all 9 Studio tools.
"""

import json
import re
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.llm.base import BaseLLMProvider
from app.services.llm.factory import LLMProviderFactory
from app.services.llm.models import LLMMessage

logger = get_logger("studio.base")


class BaseStudioService:
    """Base class providing shared LLM communication and context formatting for Studio tools."""

    def __init__(self, settings: Optional[Settings] = None, llm_provider: Optional[BaseLLMProvider] = None) -> None:
        self.settings = settings or get_settings()
        self.llm = llm_provider or LLMProviderFactory.get_provider(self.settings)

    def format_sources_context(self, sources_data: List[Dict[str, Any]]) -> str:
        """Format a list of sources with strict delimited headers and source index tags."""
        blocks = []
        for idx, src in enumerate(sources_data, 1):
            title = src.get("title", f"Source {idx}")
            content = src.get("content", "") or src.get("raw_content", "") or ""
            doc_type = src.get("source_type", "document")
            blocks.append(
                f"--- BEGIN SOURCE [{idx}] ---\n"
                f"Title: {title}\n"
                f"Type: {doc_type}\n"
                f"Content:\n{content.strip()}\n"
                f"--- END SOURCE [{idx}] ---"
            )
        return "\n\n".join(blocks) if blocks else "[No document sources provided]"

    async def generate_json(self, system_instruction: str, user_prompt: str, temperature: float = 0.2, max_tokens: int = 4096) -> Dict[str, Any]:
        """Dispatch structured generation to the LLM and return a parsed JSON object."""
        messages = [
            LLMMessage(role="system", content=system_instruction),
            LLMMessage(role="user", content=user_prompt),
        ]
        response = await self.llm.generate(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_mime_type="application/json",
        )
        raw_text = response.content.strip()

        # Clean markdown code block fences if present (```json ... ```)
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()

        try:
            return json.loads(cleaned, strict=False)
        except json.JSONDecodeError as e:
            logger.warning("Failed standard JSON decode, attempting regex repair: %s", e)
            json_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned)
            target = json_match.group(1) if json_match else cleaned
            # Remove trailing commas before closing brackets/braces
            target_repaired = re.sub(r",\s*([\]}])", r"\1", target)
            try:
                return json.loads(target_repaired, strict=False)
            except Exception:
                pass
            raise ValueError(f"LLM did not return valid JSON. Raw response: {raw_text[:300]}")
