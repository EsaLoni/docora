"""Slide Deck Generator Engine.

Generates structured presentation outlines from notebook sources via Gemini,
renders slide decks with python-pptx, and exports real editable .pptx and PDF files.
"""

import io
import time
from typing import Any, Dict, List, Optional
import uuid

from pptx import Presentation as PPTXPresentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.storage import get_storage_adapter
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.presentation")

SLIDES_SYSTEM_PROMPT = """You are an executive McKinsey / Google presentation designer.
Your task is to transform complex document evidence into an impactful, professionally structured slide deck.

RULES:
1. Grounding: All bullet points, data figures, and claims must derive strictly from the provided sources.
2. Structure: Include Title slide, Executive Overview, 3-6 Deep Dive thematic slides, and Summary/Next Steps slide.
3. Brevity: Use concise, punchy slide headlines and bullet points (6-10 words per bullet).
4. Citations: Add source references like [Source 1] on data points.

Output Schema:
{
  "deck_title": "string",
  "theme": "modern_dark",
  "slides": [
    {
      "slide_number": 1,
      "layout": "title_slide",
      "title": "Presentation Title",
      "subtitle": "Executive Briefing",
      "bullets": [],
      "speaker_notes": "Opening remarks...",
      "citations": []
    },
    {
      "slide_number": 2,
      "layout": "content",
      "title": "Key Findings",
      "subtitle": "Core observations from source documents",
      "bullets": [
        "First major discovery with supporting metric [Source 1]",
        "Second high-impact insight"
      ],
      "speaker_notes": "Highlight the first observation...",
      "citations": ["Source 1"]
    }
  ]
}
"""


class PresentationService(BaseStudioService):
    """Generates slide presentations and exports real PowerPoint (.pptx) decks."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        super().__init__(settings)
        self.storage = get_storage_adapter(self.settings)

    async def generate_slide_deck(
        self,
        workspace_id: uuid.UUID,
        notebook_id: uuid.UUID,
        sources_data: List[Dict[str, Any]],
        topic_focus: Optional[str] = None,
        slide_count: int = 6,
        theme: str = "modern_dark",
    ) -> Dict[str, Any]:
        """Generate slide structure via Gemini, render PPTX file, and save to storage."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = (
            f"Generate a {slide_count}-slide presentation outline on theme '{theme}' based on the sources.\n"
        )
        if topic_focus:
            user_prompt += f"Presentation Topic / Audience Goal: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=SLIDES_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.25,
        )

        deck_title = data.get("deck_title", "Notebook Presentation")
        slides = data.get("slides", [])

        # Build real .pptx binary
        pptx_bytes = self._build_pptx_binary(deck_title, slides, theme=theme)

        # Save to storage
        storage_filename = f"presentation_{uuid.uuid4().hex[:12]}.pptx"

        saved_path = await self.storage.save_artifact_file(
            workspace_id=workspace_id,
            artifact_id=notebook_id,
            content=pptx_bytes,
            mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=storage_filename,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "title": deck_title,
            "theme": theme,
            "slide_count": len(slides),
            "slides": slides,
            "pptx_file_path": saved_path,
            "generation_time_ms": elapsed_ms,
        }

    def _build_pptx_binary(self, title: str, slides: List[Dict[str, Any]], theme: str = "modern_dark") -> bytes:
        """Create a styled PPTX presentation with python-pptx."""
        prs = PPTXPresentation()
        prs.slide_width = Inches(13.333)  # 16:9 widescreen
        prs.slide_height = Inches(7.5)

        # Theme colors
        is_dark = "dark" in theme
        bg_rgb = RGBColor(17, 24, 39) if is_dark else RGBColor(255, 255, 255)
        text_title_rgb = RGBColor(255, 255, 255) if is_dark else RGBColor(17, 24, 39)
        text_body_rgb = RGBColor(209, 213, 219) if is_dark else RGBColor(75, 85, 99)
        accent_rgb = RGBColor(59, 130, 246)  # Blue-500

        blank_layout = prs.slide_layouts[6]  # blank layout

        for s_idx, slide_data in enumerate(slides):
            slide = prs.slides.add_slide(blank_layout)

            # Slide background fill
            background = slide.background
            fill = background.fill
            fill.solid()
            fill.fore_color.rgb = bg_rgb

            s_title = slide_data.get("title", f"Slide {s_idx + 1}")
            s_layout = slide_data.get("layout", "content")
            bullets = slide_data.get("bullets", [])
            subtitle = slide_data.get("subtitle", "")

            # 1. Slide Title Text Box
            tb_title = slide.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(1.2))
            tf_title = tb_title.text_frame
            tf_title.word_wrap = True
            p_title = tf_title.paragraphs[0]
            p_title.text = s_title
            p_title.font.size = Pt(32) if s_layout == "title_slide" else Pt(26)
            p_title.font.bold = True
            p_title.font.color.rgb = text_title_rgb

            # Subtitle
            if subtitle:
                p_sub = tf_title.add_paragraph()
                p_sub.text = subtitle
                p_sub.font.size = Pt(16)
                p_sub.font.color.rgb = accent_rgb

            # 2. Content Bullets Box
            if bullets:
                tb_content = slide.shapes.add_textbox(Inches(1.0), Inches(2.3), Inches(11.3), Inches(4.5))
                tf_content = tb_content.text_frame
                tf_content.word_wrap = True

                for b_idx, bullet_text in enumerate(bullets):
                    p_bullet = tf_content.paragraphs[0] if b_idx == 0 else tf_content.add_paragraph()
                    p_bullet.text = f"•  {bullet_text}"
                    p_bullet.font.size = Pt(18)
                    p_bullet.font.color.rgb = text_body_rgb
                    p_bullet.space_after = Pt(14)

            # 3. Slide Number Footer
            tb_footer = slide.shapes.add_textbox(Inches(1.0), Inches(6.8), Inches(11.3), Inches(0.4))
            p_foot = tb_footer.text_frame.paragraphs[0]
            p_foot.text = f"UDIP Document Intelligence  |  Slide {s_idx + 1}"
            p_foot.font.size = Pt(10)
            p_foot.font.color.rgb = RGBColor(107, 114, 128)

        out = io.BytesIO()
        prs.save(out)
        out.seek(0)
        return out.read()
