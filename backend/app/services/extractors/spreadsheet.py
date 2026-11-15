"""Spreadsheet Extractor for XLSX and CSV.

Extracts tabular data, sheet hierarchies, cell structures, and generates
clean Markdown tables and structured row/column representations.
"""

import io
from typing import Any, List, Optional
import pandas as pd

from app.core.logging import get_logger
from app.services.extractors.base import (
    BaseExtractor,
    DocumentExtractionResult,
    PageExtractionResult,
    TableData,
    estimate_token_count,
)

logger = get_logger("extractors.spreadsheet")


def format_table_as_markdown(headers: List[str], rows: List[List[str]]) -> str:
    """Format headers and rows into standard Markdown table format."""
    if not headers and not rows:
        return ""
    col_count = max(len(headers), max((len(r) for r in rows), default=0))
    # Pad headers if needed
    padded_headers = headers + [""] * (col_count - len(headers))
    header_line = "| " + " | ".join(padded_headers) + " |"
    sep_line = "| " + " | ".join(["---"] * col_count) + " |"
    
    row_lines = []
    for row in rows:
        padded_row = row + [""] * (col_count - len(row))
        # Sanitize pipe symbols inside cells
        cleaned_cells = [str(c).replace("|", "\\|").replace("\n", " ") for c in padded_row]
        row_lines.append("| " + " | ".join(cleaned_cells) + " |")

    return "\n".join([header_line, sep_line] + row_lines)


class SpreadsheetExtractor(BaseExtractor):
    """Extractor for XLSX and CSV spreadsheets."""

    MAX_PREVIEW_ROWS = 1000  # Cap per page to avoid memory blowup on massive tables

    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Extract spreadsheet sheets and tabular data."""
        fname_lower = filename.lower()
        if fname_lower.endswith(".csv") or mime_type == "text/csv":
            return self._extract_csv(file_bytes, filename)
        else:
            return self._extract_xlsx(file_bytes, filename)

    def _extract_csv(self, file_bytes: bytes, filename: str) -> DocumentExtractionResult:
        """Parse CSV bytes using pandas."""
        warnings: List[str] = []
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), sep=None, engine="python", on_bad_lines="skip")
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1", on_bad_lines="skip")
                warnings.append("CSV decoded with Latin-1 fallback.")
            except Exception as e:
                logger.error("Failed to parse CSV %s: %s", filename, e)
                return DocumentExtractionResult(
                    total_pages=0,
                    pages=[],
                    warnings=[f"Failed to parse CSV: {str(e)}"],
                    success=False,
                    error_message=f"Failed to parse CSV file: {str(e)}",
                )

        headers = [str(col) for col in df.columns]
        rows = [[str(val) if pd.notna(val) else "" for val in row] for row in df.head(self.MAX_PREVIEW_ROWS).values]
        
        if len(df) > self.MAX_PREVIEW_ROWS:
            warnings.append(f"CSV truncated to first {self.MAX_PREVIEW_ROWS} rows (total rows: {len(df)}).")

        md_table = format_table_as_markdown(headers, rows)
        text_content = f"# Table: {filename}\n\n**Rows**: {len(df)} | **Columns**: {len(headers)}\n\n{md_table}"
        
        table_obj = TableData(
            headers=headers,
            rows=rows,
            markdown=md_table,
            row_count=len(df),
            column_count=len(headers),
            title=filename,
        )

        page = PageExtractionResult(
            page_number=1,
            content=text_content,
            token_count=estimate_token_count(text_content),
            has_images=False,
            ocr_applied=False,
            tables=[table_obj],
            metadata={
                "sheet_name": "CSV",
                "total_rows": len(df),
                "total_columns": len(headers),
                "columns": headers,
            },
        )

        return DocumentExtractionResult(
            total_pages=1,
            pages=[page],
            document_metadata={
                "total_rows": len(df),
                "total_columns": len(headers),
                "file_type": "csv",
            },
            warnings=warnings,
            success=True,
        )

    def _extract_xlsx(self, file_bytes: bytes, filename: str) -> DocumentExtractionResult:
        """Parse Excel workbook using openpyxl."""
        import openpyxl

        warnings: List[str] = []
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)
        except Exception as e:
            logger.error("Failed to load Excel workbook %s: %s", filename, e)
            return DocumentExtractionResult(
                total_pages=0,
                pages=[],
                warnings=[f"Failed to load Excel workbook: {str(e)}"],
                success=False,
                error_message=f"Corrupt or unsupported Excel workbook: {str(e)}",
            )

        pages: List[PageExtractionResult] = []
        sheet_names = wb.sheetnames

        for idx, sheet_name in enumerate(sheet_names, start=1):
            sheet = wb[sheet_name]
            raw_rows = []
            
            row_idx = 0
            for row in sheet.iter_rows(values_only=True):
                # Filter trailing completely empty rows
                if any(cell is not None for cell in row):
                    cell_strs = [str(c) if c is not None else "" for c in row]
                    raw_rows.append(cell_strs)
                    row_idx += 1
                    if row_idx >= self.MAX_PREVIEW_ROWS:
                        warnings.append(f"Sheet '{sheet_name}' preview truncated to {self.MAX_PREVIEW_ROWS} rows.")
                        break

            if not raw_rows:
                pages.append(
                    PageExtractionResult(
                        page_number=idx,
                        content=f"# Sheet: {sheet_name}\n\n*(Empty worksheet)*",
                        token_count=10,
                        has_images=False,
                        ocr_applied=False,
                        tables=[],
                        metadata={"sheet_name": sheet_name, "is_empty": True},
                    )
                )
                continue

            headers = raw_rows[0]
            data_rows = raw_rows[1:] if len(raw_rows) > 1 else []
            md_table = format_table_as_markdown(headers, data_rows)
            text_content = (
                f"# Sheet {idx}: {sheet_name}\n\n"
                f"**Rows**: {len(raw_rows)} | **Columns**: {len(headers)}\n\n"
                f"{md_table}"
            )

            table_obj = TableData(
                headers=headers,
                rows=data_rows,
                markdown=md_table,
                row_count=len(raw_rows),
                column_count=len(headers),
                title=sheet_name,
            )

            pages.append(
                PageExtractionResult(
                    page_number=idx,
                    content=text_content,
                    token_count=estimate_token_count(text_content),
                    has_images=False,
                    ocr_applied=False,
                    tables=[table_obj],
                    metadata={
                        "sheet_name": sheet_name,
                        "row_count": len(raw_rows),
                        "col_count": len(headers),
                    },
                )
            )

        wb.close()

        return DocumentExtractionResult(
            total_pages=len(pages),
            pages=pages,
            document_metadata={
                "sheet_names": sheet_names,
                "sheet_count": len(sheet_names),
                "file_type": "xlsx",
            },
            warnings=warnings,
            success=True,
        )
