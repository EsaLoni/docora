"""Base Extractor Interface and Standardized Data Models.

Defines the contract for all document extractors (PDF, DOCX, XLSX/CSV, TXT, PPTX)
and standardized result containers.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TableData(BaseModel):
    """Extracted tabular structure with header, rows, and markdown representations."""

    headers: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)
    markdown: str = ""
    row_count: int = 0
    column_count: int = 0
    title: Optional[str] = None


class PageExtractionResult(BaseModel):
    """Standardized result for an individual document page or sheet."""

    page_number: int
    content: str
    token_count: int = 0
    has_images: bool = False
    ocr_applied: bool = False
    ocr_confidence: Optional[float] = None
    tables: List[TableData] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentExtractionResult(BaseModel):
    """Standardized document extraction result across all formats."""

    total_pages: int = 0
    pages: List[PageExtractionResult] = Field(default_factory=list)
    document_metadata: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
    success: bool = True
    error_message: Optional[str] = None


def estimate_token_count(text: str) -> int:
    """Accurately estimate token count without heavy tokenizer dependencies.
    
    Standard heuristic: ~4 characters or ~0.75 words per token in English.
    For mixed content, max(len(words), len(characters) // 4) provides a reliable upper-bound.
    """
    if not text:
        return 0
    words = text.split()
    return max(len(words), len(text) // 4)


def format_table_as_markdown(headers: List[str], rows: List[List[str]]) -> str:
    """Format headers and rows into standard Markdown table format."""
    if not headers and not rows:
        return ""
    col_count = max(len(headers), max((len(r) for r in rows), default=0))
    padded_headers = headers + [""] * (col_count - len(headers))
    header_line = "| " + " | ".join(padded_headers) + " |"
    separator_line = "| " + " | ".join(["---"] * col_count) + " |"
    data_lines = [
        "| " + " | ".join(r + [""] * (col_count - len(r))) + " |"
        for r in rows
    ]
    return "\n".join([header_line, separator_line] + data_lines)


class BaseExtractor(ABC):
    """Abstract base class for all file format extractors."""

    @abstractmethod
    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Extract structured pages, text, and tables from raw file bytes.

        Args:
            file_bytes: In-memory raw document bytes.
            filename: Original or sanitized file name.
            mime_type: Validated MIME type of the file.

        Returns:
            Standardized DocumentExtractionResult.
        """
        pass
