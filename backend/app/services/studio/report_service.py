"""Report Generator Engine.

Produces 12 structured report archetypes from notebook sources via Gemini,
and generates downloadable, formatted Microsoft Word (.docx) and Markdown files.
"""

import io
import time
from typing import Any, Dict, List, Optional
import uuid

import docx
from docx.shared import Inches, Pt, RGBColor

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.storage import get_storage_adapter
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.report")

REPORT_TYPES = {
    "executive_summary": "High-level summary of strategic conclusions, key metrics, and recommended actions.",
    "research_report": "Comprehensive academic/analytical report with methodology, findings, and evidence analysis.",
    "study_guide": "Structured revision guide with key definitions, concepts, breakdown lists, and review questions.",
    "detailed_notes": "Exhaustive section-by-section breakdown capturing facts, data tables, and quote excerpts.",
    "technical_documentation": "Architecture blueprints, workflows, specifications, and implementation requirements.",
    "business_analysis": "Market context, financial performance, risk assessment, and operational opportunities.",
    "literature_review": "Comparative synthesis of ideas, arguments, agreements, and discrepancies across sources.",
    "comparison_report": "Direct side-by-side evaluation highlighting alignment, differences, and conflicting claims.",
    "qa_guide": "Structured FAQ guide addressing primary questions, answers, and source citations.",
    "blog_post": "Engaging, reader-friendly thought leadership article distilling core findings with subheadings.",
    "meeting_summary": "Executive briefing covering attendees, discussed items, core conclusions, and action items.",
    "project_briefing": "Project charter, milestones, deliverables, dependencies, and risk factors.",
}

REPORT_SYSTEM_PROMPT = """You are a senior analyst and documentation specialist.
Transform the provided source materials into an authoritative, beautifully structured report.

RULES:
1. Grounding: All numbers, quotes, and conclusions must be derived strictly from the provided sources.
2. Structure: Include a Title, Table of Contents, Executive Overview, structured body sections with clear H2/H3 headers, and Conclusion.
3. Citations: Add bracketed source citations like [Source 1] on key assertions.
4. Output: Return a JSON object matching the requested schema.

Output Schema:
{
  "report_title": "string",
  "report_type": "string",
  "table_of_contents": ["Section 1", "Section 2"],
  "content_markdown": "# Title\\n\\n## Section 1\\nContent here..."
}
"""


class ReportService(BaseStudioService):
    """Generates structured reports and exports real Word (.docx) documents."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        super().__init__(settings)
        self.storage = get_storage_adapter(self.settings)

    async def generate_report(
        self,
        workspace_id: uuid.UUID,
        notebook_id: uuid.UUID,
        sources_data: List[Dict[str, Any]],
        report_type: str = "executive_summary",
        custom_instructions: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate structured report via Gemini, export to .docx, and save to storage."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        type_desc = REPORT_TYPES.get(report_type, REPORT_TYPES["executive_summary"])
        user_prompt = (
            f"Generate an in-depth {report_type.replace('_', ' ').title()} ({type_desc}).\n"
        )
        if custom_instructions:
            user_prompt += f"Special Instructions: {custom_instructions}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=REPORT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
        )

        title = data.get("report_title", f"{report_type.replace('_', ' ').title()} Report")
        markdown_content = data.get("content_markdown", "")
        toc = data.get("table_of_contents", [])

        # Build real .docx binary
        docx_bytes = self._build_docx_binary(title, markdown_content)

        # Save to storage
        storage_filename = f"report_{report_type}_{uuid.uuid4().hex[:12]}.docx"

        saved_path = await self.storage.save_artifact_file(
            workspace_id=workspace_id,
            artifact_id=notebook_id,
            content=docx_bytes,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=storage_filename,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "title": title,
            "report_type": report_type,
            "table_of_contents": toc,
            "content_markdown": markdown_content,
            "docx_file_path": saved_path,
            "generation_time_ms": elapsed_ms,
        }

    def _build_docx_binary(self, title: str, markdown_content: str) -> bytes:
        """Create a styled DOCX document with python-docx."""
        doc = docx.Document()

        # Document Header Title
        title_para = doc.add_paragraph()
        run_title = title_para.add_run(title)
        run_title.font.size = Pt(22)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(17, 24, 39)
        title_para.paragraph_format.space_after = Pt(12)

        # Subtitle rule
        p_sub = doc.add_paragraph()
        p_sub.add_run("Universal Document Intelligence Platform  |  Grounded AI Report").font.size = Pt(10)
        p_sub.paragraph_format.space_after = Pt(18)

        # Split markdown into basic paragraphs and headings
        lines = markdown_content.split("\n")
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            if line_str.startswith("# "):
                pass  # Skip duplicate h1
            elif line_str.startswith("## "):
                h2 = doc.add_heading(line_str[3:], level=1)
                h2.paragraph_format.space_before = Pt(14)
                h2.paragraph_format.space_after = Pt(6)
            elif line_str.startswith("### "):
                h3 = doc.add_heading(line_str[4:], level=2)
                h3.paragraph_format.space_before = Pt(10)
                h3.paragraph_format.space_after = Pt(4)
            elif line_str.startswith("- ") or line_str.startswith("* "):
                p_bullet = doc.add_paragraph(line_str[2:], style="List Bullet")
                p_bullet.paragraph_format.space_after = Pt(3)
            else:
                p_text = doc.add_paragraph(line_str)
                p_text.paragraph_format.space_after = Pt(6)

        out = io.BytesIO()
        doc.save(out)
        out.seek(0)
        return out.read()
