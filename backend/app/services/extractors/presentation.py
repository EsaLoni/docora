"""Presentation Extractor for PPTX files using python-pptx.

Extracts slide titles, body text frames, shapes, tables, and speaker notes
with slide-to-page 1:1 mapping.
"""

import io
from typing import Any, List, Optional
import pptx

from app.core.logging import get_logger
from app.services.extractors.base import (
    BaseExtractor,
    DocumentExtractionResult,
    PageExtractionResult,
    TableData,
    estimate_token_count,
)
from app.services.extractors.spreadsheet import format_table_as_markdown

logger = get_logger("extractors.presentation")


class PresentationExtractor(BaseExtractor):
    """Extractor for Microsoft PowerPoint (.pptx) presentations."""

    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Extract slide text, tables, shapes, and notes from PPTX bytes."""
        warnings: List[str] = []

        try:
            prs = pptx.Presentation(io.BytesIO(file_bytes))
        except Exception as e:
            logger.error("Failed to parse PPTX %s: %s", filename, e)
            return DocumentExtractionResult(
                total_pages=0,
                pages=[],
                warnings=[f"Failed to open PPTX presentation: {str(e)}"],
                success=False,
                error_message=f"Corrupt or invalid PowerPoint presentation: {str(e)}",
            )

        pages: List[PageExtractionResult] = []
        total_slides = len(prs.slides)

        for slide_idx, slide in enumerate(prs.slides, start=1):
            slide_text_blocks: List[str] = []
            tables: List[TableData] = []
            has_images = False

            # 1. Slide Title
            slide_title = ""
            if slide.shapes.title and slide.shapes.title.has_text_frame:
                slide_title = slide.shapes.title.text_frame.text.strip()
                if slide_title:
                    slide_text_blocks.append(f"# {slide_title}")

            # 2. Iterate Shapes
            for shape in slide.shapes:
                # Check for images
                if shape.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.PICTURE:
                    has_images = True

                # Process Tables
                if shape.has_table:
                    table = shape.table
                    raw_rows = []
                    for row in table.rows:
                        row_vals = [c.text.strip() for c in row.cells]
                        raw_rows.append(row_vals)

                    if raw_rows:
                        headers = raw_rows[0]
                        data_rows = raw_rows[1:] if len(raw_rows) > 1 else []
                        md_table = format_table_as_markdown(headers, data_rows)
                        tables.append(
                            TableData(
                                headers=headers,
                                rows=data_rows,
                                markdown=md_table,
                                row_count=len(raw_rows),
                                column_count=len(headers),
                                title=f"Slide {slide_idx} Table",
                            )
                        )
                        slide_text_blocks.append(f"\n{md_table}\n")

                # Process Text Frames (excluding title already captured)
                elif shape.has_text_frame and shape != slide.shapes.title:
                    shape_paragraphs = [
                        p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip()
                    ]
                    if shape_paragraphs:
                        slide_text_blocks.append("\n".join(shape_paragraphs))

            # 3. Speaker notes
            notes_text = ""
            try:
                if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                    notes_text = slide.notes_slide.notes_text_frame.text.strip()
                    if notes_text:
                        slide_text_blocks.append(f"\n*Speaker Notes:*\n{notes_text}")
            except Exception:
                pass

            content = "\n\n".join(slide_text_blocks).strip()
            if not content:
                content = f"*(Slide {slide_idx} has no text)*"

            page = PageExtractionResult(
                page_number=slide_idx,
                content=content,
                token_count=estimate_token_count(content),
                has_images=has_images,
                ocr_applied=False,
                tables=tables,
                metadata={
                    "slide_title": slide_title,
                    "has_notes": bool(notes_text),
                },
            )
            pages.append(page)

        return DocumentExtractionResult(
            total_pages=len(pages),
            pages=pages,
            document_metadata={
                "slide_count": total_slides,
                "file_type": "pptx",
            },
            warnings=warnings,
            success=True,
        )
