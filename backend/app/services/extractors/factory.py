"""Document Extractor Factory.

Resolves the appropriate extractor instance based on verified MIME types and document metadata.
"""

from typing import Optional

from app.core.exceptions import UDIPException
from app.services.extractors.base import BaseExtractor
from app.services.extractors.docx import DOCXExtractor
from app.services.extractors.ocr import OCRExtractor
from app.services.extractors.pdf import PDFExtractor
from app.services.extractors.presentation import PresentationExtractor
from app.services.extractors.spreadsheet import SpreadsheetExtractor
from app.services.extractors.text import TextExtractor


class UnsupportedExtractorError(UDIPException):
    """Raised when no suitable extractor exists for the requested document type."""

    def __init__(self, mime_type: Optional[str], filename: Optional[str]) -> None:
        super().__init__(
            message=f"No supported extractor found for MIME type '{mime_type}' or filename '{filename}'.",
            status_code=415,
            error_code="UNSUPPORTED_MEDIA_TYPE",
            details={"mime_type": mime_type, "filename": filename},
        )


class DocumentExtractorFactory:
    """Factory that instantiates and caches extractors according to validated MIME type."""

    _pdf_extractor: Optional[PDFExtractor] = None
    _docx_extractor: Optional[DOCXExtractor] = None
    _spreadsheet_extractor: Optional[SpreadsheetExtractor] = None
    _text_extractor: Optional[TextExtractor] = None
    _ocr_extractor: Optional[OCRExtractor] = None
    _presentation_extractor: Optional[PresentationExtractor] = None

    @classmethod
    def get_extractor(
        cls,
        mime_type: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> BaseExtractor:
        """Select extractor using verified MIME type and normalized file extension."""
        clean_mime = (mime_type or "").strip().lower()
        clean_name = (filename or "").strip().lower()

        # 1. PDF
        if clean_mime == "application/pdf" or clean_name.endswith(".pdf"):
            if cls._pdf_extractor is None:
                cls._pdf_extractor = PDFExtractor()
            return cls._pdf_extractor

        # 2. DOCX
        if (
            clean_mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            or clean_mime == "application/msword"
            or clean_name.endswith(".docx")
            or clean_name.endswith(".doc")
        ):
            if cls._docx_extractor is None:
                cls._docx_extractor = DOCXExtractor()
            return cls._docx_extractor

        # 3. Spreadsheets (XLSX, CSV)
        if (
            clean_mime in (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
                "text/csv",
            )
            or clean_name.endswith(".xlsx")
            or clean_name.endswith(".csv")
        ):
            if cls._spreadsheet_extractor is None:
                cls._spreadsheet_extractor = SpreadsheetExtractor()
            return cls._spreadsheet_extractor

        # 4. Text and Markdown
        if (
            clean_mime in ("text/plain", "text/markdown", "application/x-markdown")
            or clean_name.endswith(".txt")
            or clean_name.endswith(".md")
            or clean_name.endswith(".text")
        ):
            if cls._text_extractor is None:
                cls._text_extractor = TextExtractor()
            return cls._text_extractor

        # 5. Presentation (PPTX)
        if (
            clean_mime == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            or clean_name.endswith(".pptx")
        ):
            if cls._presentation_extractor is None:
                cls._presentation_extractor = PresentationExtractor()
            return cls._presentation_extractor

        # 6. Standalone Images for OCR
        if (
            clean_mime.startswith("image/")
            or clean_name.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"))
        ):
            if cls._ocr_extractor is None:
                cls._ocr_extractor = OCRExtractor()
            return cls._ocr_extractor

        raise UnsupportedExtractorError(mime_type, filename)
