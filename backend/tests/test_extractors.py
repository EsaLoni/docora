"""Tests for UDIP Document Extractors.

Verifies Text, Spreadsheet (CSV/XLSX), DOCX, Presentation (PPTX),
PDF, and the DocumentExtractorFactory.
"""

import asyncio
import io
import docx
import pymupdf as fitz
import openpyxl
import pptx
import pytest

from app.services.extractors.base import TableData, estimate_token_count
from app.services.extractors.docx import DOCXExtractor
from app.services.extractors.factory import DocumentExtractorFactory, UnsupportedExtractorError
from app.services.extractors.pdf import PDFExtractor
from app.services.extractors.presentation import PresentationExtractor
from app.services.extractors.spreadsheet import SpreadsheetExtractor, format_table_as_markdown
from app.services.extractors.text import TextExtractor


def test_text_extractor_plain():
    """Verify plain text extraction and pagination."""
    extractor = TextExtractor()
    content = "Hello, world!\n\nThis is a simple plain text test for UDIP extraction."
    raw_bytes = content.encode("utf-8")

    res = asyncio.run(extractor.extract(raw_bytes, "test.txt", "text/plain"))
    assert res.success is True
    assert res.total_pages == 1
    assert "Hello, world!" in res.pages[0].content
    assert res.pages[0].token_count > 0
    assert res.pages[0].has_images is False
    assert res.pages[0].ocr_applied is False


def test_text_extractor_empty():
    """Verify empty text file handling."""
    extractor = TextExtractor()
    res = asyncio.run(extractor.extract(b"", "empty.txt", "text/plain"))
    assert res.success is True
    assert res.total_pages == 1
    assert res.pages[0].content == ""


def test_text_extractor_markdown_tables():
    """Verify table extraction from Markdown documents."""
    extractor = TextExtractor()
    md_content = """# Architecture Overview

Here is a comparison table:

| Service | Protocol | Status |
|---|---|---|
| API Gateway | HTTPS | Active |
| Worker Engine | Asyncio | Active |
| Database | asyncpg | Active |

End of document.
"""
    res = asyncio.run(extractor.extract(md_content.encode("utf-8"), "arch.md", "text/markdown"))
    assert res.success is True
    assert res.total_pages == 1
    assert len(res.pages[0].tables) == 1
    tab = res.pages[0].tables[0]
    assert tab.headers == ["Service", "Protocol", "Status"]
    assert len(tab.rows) == 3
    assert tab.rows[0][0] == "API Gateway"


def test_spreadsheet_extractor_csv():
    """Verify CSV extraction and markdown table rendering."""
    extractor = SpreadsheetExtractor()
    csv_bytes = b"Quarter,Revenue,Expenses,Profit\nQ1 2026,1000,700,300\nQ2 2026,1200,800,400\n"

    res = asyncio.run(extractor.extract(csv_bytes, "financials.csv", "text/csv"))
    assert res.success is True
    assert res.total_pages == 1
    assert len(res.pages[0].tables) == 1
    tab = res.pages[0].tables[0]
    assert tab.headers == ["Quarter", "Revenue", "Expenses", "Profit"]
    assert tab.row_count == 2
    assert "Q1 2026" in res.pages[0].content


def test_spreadsheet_extractor_xlsx():
    """Verify multi-sheet XLSX extraction."""
    wb = openpyxl.Workbook()
    # Sheet 1
    ws1 = wb.active
    ws1.title = "Summary"
    ws1.append(["Metric", "Value"])
    ws1.append(["Active Workspaces", 42])
    ws1.append(["Total Documents", 1380])

    # Sheet 2
    ws2 = wb.create_sheet(title="Audit Log")
    ws2.append(["Timestamp", "User", "Action"])
    ws2.append(["2026-11-13T10:00:00Z", "admin@udip.local", "UPLOAD"])

    buf = io.BytesIO()
    wb.save(buf)
    xlsx_bytes = buf.getvalue()

    extractor = SpreadsheetExtractor()
    res = asyncio.run(extractor.extract(
        xlsx_bytes,
        "report.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ))
    assert res.success is True
    assert res.total_pages == 2
    assert res.pages[0].metadata["sheet_name"] == "Summary"
    assert res.pages[1].metadata["sheet_name"] == "Audit Log"
    assert len(res.pages[0].tables) == 1
    assert res.pages[0].tables[0].headers == ["Metric", "Value"]


def test_pdf_extractor():
    """Verify PyMuPDF digital PDF text and metadata extraction."""
    doc = fitz.open()
    page1 = doc.new_page(width=595, height=842)
    page1.insert_text((50, 100), "UDIP PDF Extraction Verification Page 1")
    page2 = doc.new_page(width=595, height=842)
    page2.insert_text((50, 100), "Second page with more details and compliance clauses.")

    doc.set_metadata({"title": "Test Architecture Report", "author": "Chief Architect"})
    pdf_bytes = doc.tobytes()
    doc.close()

    extractor = PDFExtractor()
    res = asyncio.run(extractor.extract(pdf_bytes, "architecture.pdf", "application/pdf"))
    assert res.success is True
    assert res.total_pages == 2
    assert "UDIP PDF Extraction Verification" in res.pages[0].content
    assert "Second page" in res.pages[1].content
    assert res.document_metadata.get("title") == "Test Architecture Report"
    assert res.document_metadata.get("author") == "Chief Architect"
    assert res.pages[0].metadata["width"] == 595
    assert res.pages[0].metadata["height"] == 842


def test_docx_extractor():
    """Verify python-docx paragraphs, headings, and tables extraction."""
    doc = docx.Document()
    doc.add_heading("Project Overview", level=1)
    doc.add_paragraph("This is a test paragraph within the DOCX document.")

    table = doc.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Header A"
    table.rows[0].cells[1].text = "Header B"
    table.rows[1].cells[0].text = "Value 1"
    table.rows[1].cells[1].text = "Value 2"

    buf = io.BytesIO()
    doc.save(buf)
    docx_bytes = buf.getvalue()

    extractor = DOCXExtractor()
    res = asyncio.run(extractor.extract(
        docx_bytes,
        "spec.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ))
    assert res.success is True
    assert res.total_pages >= 1
    assert "Project Overview" in res.pages[0].content
    assert "This is a test paragraph" in res.pages[0].content
    assert len(res.pages[0].tables) == 1
    assert res.pages[0].tables[0].headers == ["Header A", "Header B"]


def test_presentation_extractor():
    """Verify python-pptx slide text, tables, and speaker notes."""
    prs = pptx.Presentation()
    slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(slide_layout)
    slide.shapes.title.text = "UDIP Platform Keynote"
    slide.placeholders[1].text = "Next-Generation Document Intelligence"

    buf = io.BytesIO()
    prs.save(buf)
    pptx_bytes = buf.getvalue()

    extractor = PresentationExtractor()
    res = asyncio.run(extractor.extract(
        pptx_bytes,
        "keynote.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ))
    assert res.success is True
    assert res.total_pages == 1
    assert "UDIP Platform Keynote" in res.pages[0].content
    assert "Next-Generation Document Intelligence" in res.pages[0].content


def test_factory_mime_resolution():
    """Verify factory dispatches to correct extractor instances."""
    pdf_ext = DocumentExtractorFactory.get_extractor("application/pdf", "doc.pdf")
    assert pdf_ext.__class__.__name__ == "PDFExtractor"

    csv_ext = DocumentExtractorFactory.get_extractor("text/csv", "data.csv")
    assert isinstance(csv_ext, SpreadsheetExtractor)

    xlsx_ext = DocumentExtractorFactory.get_extractor(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "data.xlsx",
    )
    assert isinstance(xlsx_ext, SpreadsheetExtractor)

    docx_ext = DocumentExtractorFactory.get_extractor(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "memo.docx",
    )
    assert isinstance(docx_ext, DOCXExtractor)

    txt_ext = DocumentExtractorFactory.get_extractor("text/plain", "notes.txt")
    assert isinstance(txt_ext, TextExtractor)

    with pytest.raises(UnsupportedExtractorError):
        DocumentExtractorFactory.get_extractor("application/x-dosexec", "malicious.exe")


def test_token_estimation_heuristic():
    """Verify token estimation calculation."""
    assert estimate_token_count("") == 0
    assert estimate_token_count("one two three four five") == 5
    long_str = "a" * 100
    assert estimate_token_count(long_str) == 25
