"""Public Configuration Endpoint for UDIP.

Exposes non-sensitive runtime parameters to the frontend including
active model label, API URL, supported languages, limits, and feature flags.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings

router = APIRouter(prefix="/config", tags=["Configuration"])


class LanguageOption(BaseModel):
    code: str
    name: str
    native: str


class PublicLimits(BaseModel):
    max_upload_size_mb: int = 50
    max_sources_per_notebook: int = 50
    max_tokens_per_source: int = 500000
    daily_quota_generations: int = 100


class PublicConfigResponse(BaseModel):
    api_url: str
    model_name: str
    model_label: str
    supported_languages: List[LanguageOption]
    limits: PublicLimits
    feature_flags: Dict[str, bool]


SUPPORTED_LANGUAGES: List[LanguageOption] = [
    LanguageOption(code="en", name="English", native="English"),
    LanguageOption(code="hi", name="Hindi", native="हिन्दी"),
    LanguageOption(code="es", name="Spanish", native="Español"),
    LanguageOption(code="fr", name="French", native="Français"),
    LanguageOption(code="de", name="German", native="Deutsch"),
    LanguageOption(code="ja", name="Japanese", native="日本語"),
    LanguageOption(code="zh", name="Chinese", native="中文"),
    LanguageOption(code="ar", name="Arabic", native="العربية"),
]


@router.get("/public", response_model=PublicConfigResponse)
async def get_public_config(
    settings: Settings = Depends(get_settings),
) -> PublicConfigResponse:
    """Return public platform configuration for frontend consumption."""
    model_name = getattr(settings, "LLM_MODEL_NAME", "gemini-3.8-flash")
    label_map = {
        "gemini-3.8-flash": "Gemini 3.8 Flash",
        "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
    }
    model_label = label_map.get(model_name, "Gemini 3.8 Flash")

    return PublicConfigResponse(
        api_url=getattr(settings, "PUBLIC_API_URL", "http://localhost:8000"),
        model_name=model_name,
        model_label=model_label,
        supported_languages=SUPPORTED_LANGUAGES,
        limits=PublicLimits(),
        feature_flags={
            "web_discovery": True,
            "deep_research": True,
            "audio_overview": True,
            "interactive_quiz": True,
            "flashcards": True,
            "mindmap": True,
            "slide_deck": True,
            "reports": True,
            "infographics": True,
            "data_tables": True,
            "video_storyboard": True,
            "command_palette": True,
        },
    )
