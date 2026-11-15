"""DOCX Document Extractor.

Extracts text, headings, lists, tables, and document metadata from Microsoft Word (.docx) files.
Preserves document hierarchy and handles logical page splits and table formatting.
"""

import io
from typing import Any, List, Optional
import docx

from app.core.logging import get_logger
from app.services.extractors.base import (
    BaseExtractor,
    DocumentExtractionResult,
    PageExtractionResult,
    TableData,
    estimate_token_count,
)
from app.services.extractors.spreadsheet import format_table_as_markdown

logger = get_logger("extractors.docx")


class DOCXExtractor(BaseExtractor):
    """Extractor for Microsoft Word (.docx) documents."""

    PAGE_CHAR_TARGET = 3000

    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Extract paragraphs, headings, tables and metadata from DOCX bytes."""
        warnings: List[str] = []

        try:
            doc = docx.Document(io.BytesIO(file_bytes))
        except Exception as e:
            logger.error("Failed to parse DOCX %s: %s", filename, e)
            return DocumentExtractionResult(
                total_pages=0,
                pages=[],
                warnings=[f"Failed to open DOCX: {str(e)}"],
                success=False,
                error_message=f"Corrupt or unsupported Word document: {str(e)}",
            )

        # 1. Extract metadata
        meta = {}
        try:
            core = doc.core_properties
            if core.title:
                meta["title"] = core.title
            if core.author:
                meta["author"] = core.author
            if core.created:
                meta["created"] = str(core.created)
            if core.modified:
                meta["modified"] = str(core.modified)
            if core.revision:
                meta["revision"] = core.revision
        except Exception as meta_err:
            warnings.append(f"Could not read core properties: {str(meta_err)}")

        # 2. Check for image parts
        has_images = False
        try:
            for rel in doc.part.rels.values():
                if "image" in rel.target_ref:
                    has_images = True
                    break
        except Exception:
            pass

        # 3. Extract text paragraphs with heading annotations
        extracted_sections: List[str] = []
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            style_name = p.style.name.lower() if p.style else ""
            if "title" in style_name:
                extracted_sections.append(f"# {text}")
            elif "heading 1" in style_name:
                extracted_sections.append(f"## {text}")
            elif "heading 2" in style_name:
                extracted_sections.append(f"### {text}")
            elif "heading 3" in style_name:
                extracted_sections.append(f"#### {text}")
            elif "list" in style_name or "bullet" in style_name:
                extracted_sections.append(f"- {text}")
            else:
                extracted_sections.append(text)

        # 4. Extract tables
        all_tables: List[TableData] = []
        table_sections: List[str] = []
        for t_idx, table in enumerate(doc.tables, start=1):
            table_rows: List[List[str]] = []
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells]
                # Avoid duplicate cell texts caused by merged cells
                cleaned_cells = []
                for cell in row_cells:
                    if not cleaned_cells or cell != cleaned_cells[-1]:
                        cleaned_cells.append(cell)
                    else:
                        cleaned_cells.append("")
                table_rows.append(cleaned_cells)

            if not table_rows:
                continue

            headers = table_rows[0]
            data_rows = table_rows[1:] if len(table_rows) > 1 else []
            md_table = format_table_as_markdown(headers, data_rows)

            t_data = TableData(
                headers=headers,
                rows=data_rows,
                markdown=md_table,
                row_count=len(table_rows),
                column_count=len(headers),
                title=f"Table {t_idx}",
            )
            all_tables.append(t_data)
            table_sections.append(f"\n### Table {t_idx}\n\n{md_table}\n")

        # 5. Assemble content and split into logical pages
        full_text_blocks = extracted_sections + table_sections
        if not full_text_blocks:
            return DocumentExtractionResult(
                total_pages=1,
                pages=[
                    PageExtractionResult(
                        page_number=1,
                        content="",
                        token_count=0,
                        has_images=has_images,
                        ocr_applied=False,
                        metadata=meta,
                    )
                ],
                document_metadata=meta,
                warnings=warnings,
                success=True,
            )

        pages = self._assemble_pages(full_text_blocks, all_tables, has_images)

        return DocumentExtractionResult(
            total_pages=len(pages),
            pages=pages,
            document_metadata={
                **meta,
                "paragraph_count": len(extracted_sections),
                "table_count": len(all_tables),
                "has_images": has_images,
            },
            warnings=warnings,
            success=True,
        )

    def _assemble_pages(
        self,
        blocks: List[str],
        tables: List[TableData],
        has_images: bool,
    ) -> List[PageExtractionResult]:
        """Group blocks into balanced pages of ~PAGE_CHAR_TARGET chars."""
        pages: List[PageExtractionResult] = []
        current_blocks: List[str] = []
        current_len = 0
        page_num = 1

        for block in blocks:
            blen = len(block)
            if current_len + blen > self.PAGE_CHAR_TARGET and current_blocks:
                content = "\n\n".join(current_blocks)
                pages.append(
                    PageExtractionResult(
                        page_number=page_num,
                        content=content,
                        token_count=estimate_token_count(content),
                        has_images=has_images,
                        ocr_applied=False,
                        tables=tables if page_num == 1 else [],
                    )
                )
                page_num += 1
                current_blocks = [block]
                current_len = blen
            else:
                current_blocks.append(block)
                current_len += blen

        if current_blocks:
            content = "\n\n".join(current_blocks)
            pages.append(
                PageExtractionResult(
                    page_number=page_num,
                    content=content,
                    token_count=estimate_token_count(content),
                    has_images=has_images,
                    ocr_applied=False,
                    tables=tables if page_num == 1 else [],
                )
            )

        return pages
