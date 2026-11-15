"""Flashcard Generator Engine.

Generates source-grounded interactive flashcard decks with difficulty ratings,
explanations, and citations for active recall and spaced repetition.
"""

import time
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.flashcard")

FLASHCARDS_SYSTEM_PROMPT = """You are an expert cognitive scientist and educator specializing in active recall and spaced repetition.
Generate an impactful, source-grounded flashcard deck from the provided document materials.

RULES:
1. Grounding: Every question and answer must derive directly from the source evidence.
2. Clarity: Fronts should be clear, challenging prompts or questions. Backs should be direct, informative answers.
3. Categorization: Assign difficulty as "easy", "medium", or "hard".
4. Citations: Link each card to source references.

Output Schema:
{
  "deck_title": "string",
  "cards": [
    {
      "id": "card-1",
      "front": "What is the primary objective of ...?",
      "back": "The primary objective is ...",
      "difficulty": "medium",
      "explanation": "Contextual nuance from the document...",
      "source_ref": "Source 1, Page 2"
    }
  ]
}
"""


class FlashcardService(BaseStudioService):
    """Generates flashcard decks for active recall learning."""

    async def generate_deck(
        self,
        sources_data: List[Dict[str, Any]],
        topic_focus: Optional[str] = None,
        card_count: int = 8,
    ) -> Dict[str, Any]:
        """Generate structured flashcard deck via Gemini."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = (
            f"Generate a {card_count}-card interactive study deck based on the source documents.\n"
        )
        if topic_focus:
            user_prompt += f"Topic Focus: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=FLASHCARDS_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        cards = data.get("cards", [])

        # Ensure unique IDs for frontend flip card keys
        for idx, card in enumerate(cards, 1):
            if "id" not in card:
                card["id"] = f"card-{idx}"

        return {
            "title": data.get("deck_title", "Notebook Flashcard Deck"),
            "card_count": len(cards),
            "cards": cards,
            "generation_time_ms": elapsed_ms,
        }
