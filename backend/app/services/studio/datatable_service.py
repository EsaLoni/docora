"""Data Table Generator & Structured Extraction Engine.

Extracts tabular schemas and structured records with page-level citations,
and exports real Microsoft Excel (.xlsx) and CSV spreadsheets.
"""

import io
import time
from typing import Any, Dict, List, Optional
import uuid

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.storage import get_storage_adapter
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.datatable")

DATATABLE_SYSTEM_PROMPT = """You are an expert data engineer and structured information extractor.
Analyze the provided document sources and extract structured, tabular records with page-level citations.

RULES:
1. Dynamic Schema: Define clean, relevant column headers with data_type ("string", "number", "date", "currency").
2. Evidence Grounding: Every cell value must derive directly from the source text.
3. Citations: Add an explicit "source_citation" (e.g., "Source 1, Page 2") for each row.
4. Completeness: Extract all relevant entries found in the sources matching the user's extraction request.

Output Schema:
{
  "table_title": "string",
  "description": "string",
  "columns": [
    {"key": "col1", "label": "Item / Name", "data_type": "string"},
    {"key": "col2", "label": "Metric / Value", "data_type": "number"},
    {"key": "citation", "label": "Source & Page", "data_type": "string"}
  ],
  "rows": [
    {
      "col1": "Example Value",
      "col2": 45000,
      "citation": "Source 1, Page 3"
    }
  ]
}
"""


class DataTableService(BaseStudioService):
    """Extracts structured tabular data and generates real Excel (.xlsx) workbooks."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        super().__init__(settings)
        self.storage = get_storage_adapter(self.settings)

    async def generate_data_table(
        self,
        workspace_id: uuid.UUID,
        notebook_id: uuid.UUID,
        sources_data: List[Dict[str, Any]],
        extraction_request: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Extract structured tabular data via Gemini and export to .xlsx."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = "Extract a clean, structured comparison and data table from the sources.\n"
        if extraction_request:
            user_prompt += f"Extraction Goal / Desired Columns: {extraction_request}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=DATATABLE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,
        )

        title = data.get("table_title", "Extracted Data Table")
        columns = data.get("columns", [])
        rows = data.get("rows", [])

        # Build real .xlsx binary
        xlsx_bytes = self._build_xlsx_binary(title, columns, rows)

        # Save to storage
        storage_filename = f"datatable_{uuid.uuid4().hex[:12]}.xlsx"

        saved_path = await self.storage.save_artifact_file(
            workspace_id=workspace_id,
            artifact_id=notebook_id,
            content=xlsx_bytes,
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=storage_filename,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "title": title,
            "description": data.get("description", ""),
            "column_count": len(columns),
            "row_count": len(rows),
            "columns": columns,
            "rows": rows,
            "xlsx_file_path": saved_path,
            "generation_time_ms": elapsed_ms,
        }

    def _build_xlsx_binary(self, title: str, columns: List[Dict[str, Any]], rows: List[Dict[str, Any]]) -> bytes:
        """Create a styled Excel workbook with openpyxl."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = title[:30].replace("/", "-").replace("\\", "-")

        # Palette
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Slate-800
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        cell_font = Font(name="Calibri", size=10)
        border_side = Side(border_style="thin", color="CBD5E1")
        cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
        alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        # 1. Write Header Row
        col_keys = [c.get("key", f"col_{i}") for i, c in enumerate(columns)]
        for col_idx, col in enumerate(columns, 1):
            cell = ws.cell(row=1, column=col_idx, value=col.get("label", col.get("key", f"Col {col_idx}")))
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = cell_border

        # 2. Write Data Rows
        for row_idx, row_data in enumerate(rows, 2):
            is_alt = (row_idx % 2 == 0)
            for col_idx, col_key in enumerate(col_keys, 1):
                val = row_data.get(col_key, "")
                cell = ws.cell(row=row_idx, column=col_idx, value=str(val) if val is not None else "")
                cell.font = cell_font
                cell.border = cell_border
                if is_alt:
                    cell.fill = alt_fill

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 45)

        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return out.read()
