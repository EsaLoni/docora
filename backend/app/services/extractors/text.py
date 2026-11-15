"""Plain Text and Markdown Document Extractor.

Extracts text content, preserves paragraph and heading flow,
and splits large documents into balanced logical pages.
"""

import re
from typing import Any, List, Optional

from app.core.logging import get_logger
from app.services.extractors.base import (
    BaseExtractor,
    DocumentExtractionResult,
    PageExtractionResult,
    TableData,
    estimate_token_count,
)

logger = get_logger("extractors.text")


class TextExtractor(BaseExtractor):
    """Extractor for .txt, .text, and .md files."""

    PAGE_CHAR_TARGET = 3000  # ~500-600 words per logical page

    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Decode and extract text and markdown tables."""
        warnings: List[str] = []

        # 1. Decode bytes with robust encoding fallbacks
        text, used_encoding = self._decode_bytes(file_bytes)
        if used_encoding != "utf-8":
            warnings.append(f"Document decoded using fallback encoding: {used_encoding}")

        if not text.strip():
            return DocumentExtractionResult(
                total_pages=1,
                pages=[
                    PageExtractionResult(
                        page_number=1,
                        content="",
                        token_count=0,
                        has_images=False,
                        ocr_applied=False,
                        metadata={"encoding": used_encoding, "empty_document": True},
                    )
                ],
                document_metadata={"encoding": used_encoding, "char_count": 0},
                warnings=warnings,
                success=True,
            )

        # 2. Partition into logical pages
        page_chunks = self._split_into_pages(text)
        pages: List[PageExtractionResult] = []

        for idx, page_text in enumerate(page_chunks, start=1):
            clean_text = page_text.strip()
            tables = self._extract_markdown_tables(clean_text)
            pages.append(
                PageExtractionResult(
                    page_number=idx,
                    content=clean_text,
                    token_count=estimate_token_count(clean_text),
                    has_images=False,
                    ocr_applied=False,
                    tables=tables,
                    metadata={"char_count": len(clean_text)},
                )
            )

        return DocumentExtractionResult(
            total_pages=len(pages),
            pages=pages,
            document_metadata={
                "encoding": used_encoding,
                "total_char_count": len(text),
                "is_markdown": filename.lower().endswith(".md"),
            },
            warnings=warnings,
            success=True,
        )

    def _decode_bytes(self, data: bytes) -> tuple[str, str]:
        """Try decodings in sequence until one succeeds."""
        encodings = ["utf-8-sig", "utf-8", "latin-1", "cp1252", "utf-16"]
        for enc in encodings:
            try:
                return data.decode(enc), enc
            except (UnicodeDecodeError, LookupError):
                continue
        # As last resort, decode utf-8 with replacement characters
        return data.decode("utf-8", errors="replace"), "utf-8-replace"

    def _split_into_pages(self, full_text: str) -> List[str]:
        """Split text into logical pages breaking on double newlines where possible."""
        if len(full_text) <= self.PAGE_CHAR_TARGET:
            return [full_text]

        paragraphs = re.split(r"(\n\s*\n)", full_text)
        pages: List[str] = []
        current_page: List[str] = []
        current_len = 0

        for segment in paragraphs:
            seg_len = len(segment)
            if current_len + seg_len > self.PAGE_CHAR_TARGET and current_page:
                pages.append("".join(current_page))
                current_page = [segment]
                current_len = seg_len
            else:
                current_page.append(segment)
                current_len += seg_len

        if current_page:
            pages.append("".join(current_page))

        return pages or [full_text]

    def _extract_markdown_tables(self, text: str) -> List[TableData]:
        """Extract markdown pipe-table blocks if present."""
        table_regex = re.compile(
            r"((?:^[ \t]*\|.+?\|[ \t]*\n){2,})",
            re.MULTILINE,
        )
        tables: List[TableData] = []
        matches = table_regex.findall(text)

        for match in matches:
            lines = [line.strip() for line in match.strip().split("\n") if line.strip()]
            if len(lines) < 2:
                continue

            # First line is headers
            headers = [c.strip() for c in lines[0].strip("|").split("|")]
            # Check if second line is divider (e.g. |---|---|)
            has_divider = all(re.match(r"^:?-+:?$", c.strip()) for c in lines[1].strip("|").split("|"))
            data_rows = lines[2:] if has_divider else lines[1:]

            parsed_rows = []
            for r in data_rows:
                cells = [c.strip() for c in r.strip("|").split("|")]
                parsed_rows.append(cells)

            tables.append(
                TableData(
                    headers=headers,
                    rows=parsed_rows,
                    markdown=match.strip(),
                    row_count=len(parsed_rows),
                    column_count=len(headers),
                )
            )

        return tables
