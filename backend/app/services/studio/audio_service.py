"""Audio Overview / AI Podcast Generation Engine.

Synthesizes a realistic two-host conversational podcast grounded in notebook sources,
using Google Gemini for scriptwriting and Microsoft Neural Voices (edge-tts) for voice generation.
"""

import asyncio
import io
import os
import time
from typing import Any, Dict, List, Optional
import uuid

import edge_tts

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.storage import get_storage_adapter
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.audio")

VOICE_PROFILES = {
    "en": {"Alex": "en-US-GuyNeural", "Sam": "en-US-JennyNeural"},
    "es": {"Alex": "es-ES-AlvaroNeural", "Sam": "es-ES-ElviraNeural"},
    "fr": {"Alex": "fr-FR-HenriNeural", "Sam": "fr-FR-DeniseNeural"},
    "de": {"Alex": "de-DE-ConradNeural", "Sam": "de-DE-KatjaNeural"},
    "hi": {"Alex": "hi-IN-MadhurNeural", "Sam": "hi-IN-SwaraNeural"},
}

PODCAST_SYSTEM_PROMPT = """You are an award-winning executive podcast producer and scriptwriter for a show called "The Deep Dive".
Your mission is to transform complex document evidence into an engaging, natural, two-host conversational discussion.

THE HOSTS:
- Alex: The curious, enthusiastic co-host who frames the big questions, asks for clarification, and uses relatable analogies.
- Sam: The deep-thinking, analytical co-host who has thoroughly studied the provided sources and breaks down key insights, metrics, and nuances.

CRITICAL RULES:
1. STRICT GROUNDING: Every topic, metric, and insight discussed must be strictly derived from the provided sources. Do not invent facts.
2. NATURAL BANTER: Include natural transitions ("Right, exactly", "Wait, let's unpack that", "That's a fascinating point").
3. CITATIONS: Include source index references like [Source 1] whenever Sam quotes an exact finding or number.
4. FORMAT: Return a valid JSON object matching the requested schema.

Output Schema:
{
  "episode_title": "string",
  "summary": "string",
  "dialogue": [
    {
      "speaker": "Alex",
      "text": "Welcome to The Deep Dive! Today we're exploring...",
      "source_refs": []
    },
    {
      "speaker": "Sam",
      "text": "That's right, Alex. Looking closely at the data...",
      "source_refs": ["Source 1"]
    }
  ]
}
"""


class AudioOverviewService(BaseStudioService):
    """Generates two-host conversational audio overviews from notebook sources."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        super().__init__(settings)
        self.storage = get_storage_adapter(self.settings)

    async def generate_podcast_script(
        self,
        sources_data: List[Dict[str, Any]],
        topic_focus: Optional[str] = None,
        duration_style: str = "standard",  # short (4-6 turns), standard (8-12 turns), extended (14-20 turns)
        language: str = "en",
    ) -> Dict[str, Any]:
        """Generate structured dialogue between Alex and Sam via Gemini."""
        context_text = self.format_sources_context(sources_data)

        turns_target = 6 if duration_style == "short" else (16 if duration_style == "extended" else 10)
        user_prompt = (
            f"Produce an engaging {duration_style} two-host podcast episode ({turns_target} dialogue turns total) "
            f"in {language} based strictly on the following source materials.\n"
        )
        if topic_focus:
            user_prompt += f"Special Focus / Listener Question: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=PODCAST_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
        )
        return data

    async def synthesize_dialogue_to_audio(
        self,
        dialogue: List[Dict[str, Any]],
        language: str = "en",
    ) -> bytes:
        """Synthesize each dialogue turn with edge-tts and concatenate into an MP3 stream."""
        lang_voices = VOICE_PROFILES.get(language, VOICE_PROFILES["en"])
        combined_audio = io.BytesIO()

        for turn in dialogue:
            speaker = turn.get("speaker", "Alex")
            text = turn.get("text", "").strip()
            if not text:
                continue

            voice = lang_voices.get(speaker, lang_voices["Alex"])
            try:
                communicate = edge_tts.Communicate(text, voice)
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        combined_audio.write(chunk["data"])
            except Exception as e:
                logger.warning("edge-tts synthesis warning on turn (%s): %s", speaker, e)
                # Continue processing remaining turns gracefully

        combined_audio.seek(0)
        return combined_audio.read()

    async def create_audio_overview(
        self,
        workspace_id: uuid.UUID,
        notebook_id: uuid.UUID,
        sources_data: List[Dict[str, Any]],
        topic_focus: Optional[str] = None,
        duration_style: str = "standard",
        language: str = "en",
    ) -> Dict[str, Any]:
        """Full pipeline: Script generation -> Neural TTS synthesis -> Storage -> Artifact metadata."""
        start_time = time.time()
        
        # 1. Script generation via Gemini
        script_data = await self.generate_podcast_script(
            sources_data=sources_data,
            topic_focus=topic_focus,
            duration_style=duration_style,
            language=language,
        )

        dialogue = script_data.get("dialogue", [])
        episode_title = script_data.get("episode_title", "Notebook Audio Overview")

        # 2. Multi-speaker voice synthesis
        audio_bytes = await self.synthesize_dialogue_to_audio(dialogue, language=language)

        # 3. Store audio file in UDIP storage
        storage_filename = f"audio_overview_{uuid.uuid4().hex[:12]}.mp3"
        storage_key = f"{workspace_id}/notebooks/{notebook_id}/audio/{storage_filename}"

        if audio_bytes and len(audio_bytes) > 100:
            saved_key = await self.storage.save_artifact_file(
                workspace_id=workspace_id,
                artifact_id=notebook_id,
                content=audio_bytes,
                mime_type="audio/mpeg",
                filename=storage_filename,
            )
            # Estimate duration based on MP3 size (~16KB/s at 128kbps)
            estimated_duration = round(len(audio_bytes) / 16000, 1)
        else:
            saved_key = None
            estimated_duration = 0.0

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "title": episode_title,
            "summary": script_data.get("summary", ""),
            "dialogue": dialogue,
            "duration_seconds": estimated_duration,
            "audio_file_path": saved_key,
            "language": language,
            "voice_host_a": VOICE_PROFILES.get(language, VOICE_PROFILES["en"])["Alex"],
            "voice_host_b": VOICE_PROFILES.get(language, VOICE_PROFILES["en"])["Sam"],
            "generation_time_ms": elapsed_ms,
        }
