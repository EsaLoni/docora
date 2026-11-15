"""Video Overview & Storyboard Generation Engine.

Produces source-grounded scene-by-scene video storyboards, narration scripts,
visual descriptions, and rendering state tracking.
"""

import time
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.video")

VIDEO_SYSTEM_PROMPT = """You are an educational video director and storyboard artist.
Transform the provided source documents into a compelling scene-by-scene explainer video storyboard.

RULES:
1. Grounding: All concepts, narration lines, and visual cues must stem directly from the source material.
2. Structure: 4 to 8 scenes (Introduction, 3-5 Content Scenes, Conclusion).
3. Visuals: Detail visual direction (e.g., motion graphics, charts, live-action b-roll descriptions).
4. Narration: Exact voiceover script with estimated duration in seconds.

Output Schema:
{
  "video_title": "string",
  "target_duration_seconds": 90,
  "scenes": [
    {
      "scene_number": 1,
      "title": "Opening & Context",
      "duration_seconds": 12,
      "narration_script": "Welcome. In this brief overview, we break down...",
      "visual_description": "Clean dark screen with dynamic title typography fading in...",
      "on_screen_text": "Key Metric: +34%",
      "citation": "Source 1, Page 1"
    }
  ]
}
"""


class VideoOverviewService(BaseStudioService):
    """Generates structured video storyboards, narration scripts, and visual direction."""

    async def generate_storyboard(
        self,
        sources_data: List[Dict[str, Any]],
        video_style: str = "explainer",  # explainer, deep_dive, executive_summary
        topic_focus: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate scene storyboard via Gemini."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = (
            f"Generate a professional {video_style} video storyboard based strictly on the source materials.\n"
        )
        if topic_focus:
            user_prompt += f"Special Focus: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=VIDEO_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.25,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        scenes = data.get("scenes", [])

        return {
            "title": data.get("video_title", "Video Overview Storyboard"),
            "target_duration_seconds": data.get("target_duration_seconds", 90),
            "video_style": video_style,
            "scene_count": len(scenes),
            "scenes": scenes,
            "status": "storyboard_ready",
            "generation_time_ms": elapsed_ms,
        }
