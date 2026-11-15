"""Intelligence Export Engine.

Generates validated exports for:
- Summary -> Markdown, PDF
- Comparison -> CSV, PDF
- Structured Extraction -> JSON, CSV
- Insights -> Markdown, PDF
Uses PyMuPDF (fitz) for lightweight, high-performance in-memory PDF generation.
"""

import csv
import io
import json
from typing import Any, Dict, List, Optional
import pymupdf as fitz  # PyMuPDF


class IntelligenceExportService:
    """Exports intelligence reports into Markdown, JSON, CSV, and PDF formats."""

    @staticmethod
    def to_markdown(
        title: str,
        content: str,
        sections: Optional[List[Dict[str, str]]] = None,
        citations: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Formats an intelligence report into structured Github Flavored Markdown."""
        parts = [f"# {title}\n"]

        if content:
            parts.append(f"{content}\n")

        if sections:
            for sec in sections:
                sec_title = sec.get("title", "Section")
                sec_text = sec.get("text", "")
                parts.append(f"## {sec_title}\n\n{sec_text}\n")

        if citations:
            parts.append("## Supporting Citations\n")
            for i, cite in enumerate(citations, 1):
                fn = cite.get("filename", "Document")
                p = cite.get("page_number", 1)
                ex = cite.get("excerpt", "")
                parts.append(f"- **[{i}] {fn} (Page {p})**: *\"{ex}\"*\n")

        return "\n".join(parts)

    @staticmethod
    def to_json(data: Any) -> str:
        """Serializes arbitrary structured results into pretty-printed JSON."""
        return json.dumps(data, indent=2, ensure_ascii=False)

    @staticmethod
    def to_csv(headers: List[str], rows: List[List[Any]]) -> str:
        """Generates standard RFC 4180 CSV text with safe delimiter quoting."""
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for row in rows:
            clean_row = [str(cell) if cell is not None else "" for cell in row]
            writer.writerow(clean_row)
        return output.getvalue()

    @staticmethod
    def to_pdf(
        title: str,
        subtitle: str = "Universal Document Intelligence Platform Report",
        body_sections: Optional[List[Dict[str, str]]] = None,
        key_metrics: Optional[List[Dict[str, str]]] = None,
    ) -> bytes:
        """Generates a clean PDF document using PyMuPDF (fitz) without external dependencies."""
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)  # Standard A4 (points)

        y = 50.0
        # Title banner
        page.insert_text(fitz.Point(50, y), title, fontsize=18, fontname="helv", color=(0.1, 0.2, 0.4))
        y += 24.0

        page.insert_text(fitz.Point(50, y), subtitle, fontsize=10, fontname="helv", color=(0.4, 0.4, 0.4))
        y += 20.0

        # Divider line
        page.draw_line(fitz.Point(50, y), fitz.Point(545, y), color=(0.7, 0.7, 0.7), width=1)
        y += 24.0

        # Optional Key Metrics / Key-Value table
        if key_metrics:
            for metric in key_metrics:
                if y > 780:
                    page = doc.new_page(width=595, height=842)
                    y = 50.0
                k = metric.get("key", "")
                v = metric.get("value", "")
                page.insert_text(fitz.Point(50, y), f"• {k}:", fontsize=10, fontname="helv", color=(0.1, 0.1, 0.1))
                page.insert_text(fitz.Point(180, y), str(v)[:60], fontsize=10, fontname="helv", color=(0.2, 0.3, 0.6))
                y += 16.0
            y += 16.0

        # Body Sections
        if body_sections:
            for sec in body_sections:
                sec_title = sec.get("title", "")
                sec_text = sec.get("text", "")

                if y > 760:
                    page = doc.new_page(width=595, height=842)
                    y = 50.0

                if sec_title:
                    page.insert_text(fitz.Point(50, y), sec_title, fontsize=12, fontname="helv", color=(0.15, 0.25, 0.45))
                    y += 18.0

                # Wrap text lines
                words = sec_text.split()
                line = ""
                for w in words:
                    test_line = f"{line} {w}".strip()
                    # Approx 80 chars per line at 10pt
                    if len(test_line) > 80:
                        if y > 780:
                            page = doc.new_page(width=595, height=842)
                            y = 50.0
                        page.insert_text(fitz.Point(50, y), line, fontsize=9, fontname="helv", color=(0.15, 0.15, 0.15))
                        y += 14.0
                        line = w
                    else:
                        line = test_line

                if line:
                    if y > 780:
                        page = doc.new_page(width=595, height=842)
                        y = 50.0
                    page.insert_text(fitz.Point(50, y), line, fontsize=9, fontname="helv", color=(0.15, 0.15, 0.15))
                    y += 20.0

        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes
