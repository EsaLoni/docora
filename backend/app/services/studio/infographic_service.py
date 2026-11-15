"""Infographic Generator Engine.

Generates structured visual summaries (Bento grid, process flow, comparison cards)
from notebook sources with quantitative metrics, key takeaways, and source grounding.
"""

import time
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.infographic")

INFOGRAPHIC_SYSTEM_PROMPT = """You are an elite visual designer specializing in executive Bento grids and modern infographics.
Transform the provided source documents into a structured, highly engaging visual summary.

LAYOUT STYLES:
- bento_grid: 4-6 asymmetric cards highlighting core stats, key findings, and takeaways.
- timeline: Chronological steps, phases, or milestone developments.
- comparison: Side-by-side contrast between options, standards, or entities.
- process_diagram: Sequential procedural steps with inputs, transformations, and outcomes.

Output Schema:
{
  "title": "string",
  "subtitle": "string",
  "layout_style": "bento_grid",
  "hero_metric": {
    "value": "99.4%",
    "label": "Accuracy Rating",
    "citation": "Source 1, Page 2"
  },
  "sections": [
    {
      "id": "sec-1",
      "title": "Core Finding",
      "badge": "Key Fact",
      "content": "Detailed takeaway with supporting evidence...",
      "metric": "85x",
      "citation": "Source 2"
    }
  ]
}
"""


class InfographicService(BaseStudioService):
    """Generates structured visual summaries and bento-grid layouts."""

    async def generate_infographic(
        self,
        sources_data: List[Dict[str, Any]],
        layout_style: str = "bento_grid",
        topic_focus: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate structured visual infographic layout via Gemini."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = (
            f"Generate a modern {layout_style} visual infographic structure based strictly on the source documents.\n"
        )
        if topic_focus:
            user_prompt += f"Visual Theme Focus: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=INFOGRAPHIC_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.25,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "title": data.get("title", "Visual Document Infographic"),
            "subtitle": data.get("subtitle", "Grounded AI Visual Summary"),
            "layout_style": layout_style,
            "style": layout_style,
            "hero_metric": data.get("hero_metric", {}),
            "sections": data.get("sections", []),
            "generation_time_ms": elapsed_ms,
        }
