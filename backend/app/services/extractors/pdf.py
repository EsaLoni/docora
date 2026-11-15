"""PDF Extractor using PyMuPDF (fitz) with Automatic OCR Fallback.

Supports digital PDFs, scanned PDFs, mixed mode, page rotation/dimensions,
structured table detection via PyMuPDF table finder, and OCR image rendering.
"""

from typing import Any, List, Optional
from PIL import Image
import pymupdf as fitz  # PyMuPDF

from app.core.logging import get_logger
from app.services.extractors.base import (
    BaseExtractor,
    DocumentExtractionResult,
    PageExtractionResult,
    TableData,
    estimate_token_count,
    format_table_as_markdown,
)
from app.services.extractors.ocr import OCRExtractor

logger = get_logger("extractors.pdf")


class PDFExtractor(BaseExtractor):
    """Production-grade PDF extractor supporting native text, tables, and OCR fallback."""

    MIN_TEXT_CHARS_FOR_NATIVE = 50  # Below this threshold on an image-bearing page, trigger OCR

    def __init__(self) -> None:
        self.ocr_extractor = OCRExtractor()

    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Extract pages, text, tables, and apply OCR fallback where required."""
        warnings: List[str] = []

        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            logger.error("Failed to open PDF %s: %s", filename, e)
            return DocumentExtractionResult(
                total_pages=0,
                pages=[],
                warnings=[f"Failed to open PDF document: {str(e)}"],
                success=False,
                error_message=f"Corrupt or invalid PDF file: {str(e)}",
            )

        # 1. Document metadata
        doc_meta = {}
        try:
            raw_meta = doc.metadata or {}
            for key in ["title", "author", "subject", "creator", "producer", "creationDate", "modDate"]:
                if raw_meta.get(key):
                    doc_meta[key] = str(raw_meta[key])
        except Exception as m_err:
            warnings.append(f"Could not read PDF metadata: {str(m_err)}")

        total_pages = len(doc)
        pages: List[PageExtractionResult] = []

        # 2. Iterate each page
        for page_idx, page in enumerate(doc, start=1):
            page_text = page.get_text("text", sort=True).strip()
            page_images = page.get_images()
            has_images = len(page_images) > 0
            rect = page.rect
            rotation = page.rotation

            # Extract tables using PyMuPDF table finder
            tables: List[TableData] = []
            try:
                tabs = page.find_tables()
                if tabs and hasattr(tabs, "tables") and tabs.tables:
                    for t_idx, tab in enumerate(tabs.tables, start=1):
                        extracted = tab.extract()
                        if extracted and len(extracted) > 0:
                            headers = [str(c).strip() if c is not None else "" for c in extracted[0]]
                            data_rows = [
                                [str(c).strip() if c is not None else "" for c in r]
                                for r in extracted[1:]
                            ]
                            md_table = format_table_as_markdown(headers, data_rows)
                            tables.append(
                                TableData(
                                    headers=headers,
                                    rows=data_rows,
                                    markdown=md_table,
                                    row_count=len(extracted),
                                    column_count=len(headers),
                                    title=f"Page {page_idx} Table {t_idx}",
                                )
                            )
            except Exception as tab_err:
                logger.debug("Table detection on page %d skipped: %s", page_idx, tab_err)

            # Check if OCR fallback is needed (only if page contains images and native text is sparse)
            ocr_applied = False
            ocr_confidence: Optional[float] = None
            page_warnings: List[str] = []

            if has_images and len(page_text) < self.MIN_TEXT_CHARS_FOR_NATIVE:
                if self.ocr_extractor.is_available():
                    try:
                        # Render page at 150 DPI for accurate OCR without excessive memory usage
                        pix = page.get_pixmap(dpi=150)
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        ocr_text, confidence, o_warns = self.ocr_extractor.extract_image_text_and_confidence(img)
                        page_warnings.extend(o_warns)

                        # If OCR discovered meaningful text
                        if len(ocr_text) > len(page_text):
                            page_text = ocr_text
                            ocr_applied = True
                            ocr_confidence = confidence
                    except Exception as ocr_err:
                        page_warnings.append(f"OCR fallback failed on page {page_idx}: {str(ocr_err)}")
                else:
                    page_warnings.append(
                        f"Page {page_idx} contains scanned or sparse image content, but Tesseract OCR is unavailable."
                    )

            # If tables exist and are not already in page_text, append markdown representation
            if tables:
                table_mds = "\n\n".join(t.markdown for t in tables if t.markdown)
                if table_mds and table_mds not in page_text:
                    page_text = f"{page_text}\n\n### Extracted Tables\n\n{table_mds}".strip()

            page_result = PageExtractionResult(
                page_number=page_idx,
                content=page_text,
                token_count=estimate_token_count(page_text),
                has_images=has_images,
                ocr_applied=ocr_applied,
                ocr_confidence=ocr_confidence,
                tables=tables,
                warnings=page_warnings,
                metadata={
                    "width": rect.width,
                    "height": rect.height,
                    "rotation": rotation,
                    "image_count": len(page_images),
                    "table_count": len(tables),
                    "extraction_method": "ocr" if ocr_applied else "native",
                },
            )
            pages.append(page_result)
            warnings.extend(page_warnings)

        doc.close()

        return DocumentExtractionResult(
            total_pages=total_pages,
            pages=pages,
            document_metadata={
                **doc_meta,
                "total_pages": total_pages,
                "file_type": "pdf",
            },
            warnings=warnings,
            success=True,
        )
