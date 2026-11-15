"""Tests for Structured Information Extraction and Table Intelligence."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.intelligence.entity import EntityExtractionService
from app.services.intelligence.extraction import StructuredExtractionService
from app.services.intelligence.models import ExtractionRequest
from app.services.intelligence.table import TableIntelligenceService


def test_regex_entity_extraction():
    """Verify deterministic extraction of emails, phones, dates, currencies, and identifiers."""
    service = EntityExtractionService()
    sample_text = (
        "Please send the payment of $14,500.50 USD to billing@acme.com before October 15, 2026. "
        "For questions, call +1-800-555-0199. Refer to Invoice # INV-2026-901 and Contract # AGR-9921."
    )
    pages = [(1, sample_text)]
    items = service.extract_regex_entities(pages, "sample.pdf")

    field_map = {item.field_name: item for item in items}
    assert "email" in field_map
    assert field_map["email"].value == "billing@acme.com"

    assert "phone_number" in field_map
    assert "date" in field_map
    assert "monetary_amount" in field_map
    assert "invoice_number" in field_map
    assert field_map["invoice_number"].value == "INV-2026-901"
    assert "contract_identifier" in field_map


def test_structured_extraction_service(session_factory: async_sessionmaker[AsyncSession]):
    """Verify end-to-end extraction persists to extractions table and preserves nulls."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            doc = Document(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                user_id=user.id,
                title="Commercial Invoice",
                filename="invoice_3001.pdf",
                file_path="mock/path/invoice_3001.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="hash_inv",
                page_count=1,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="Vendor: Acme Technologies Inc.\nInvoice # INV-2024-9021\nDate: 2024-11-01\nTotal Amount: $45,200.00",
            )
            session.add(p1)
            await session.commit()

            service = StructuredExtractionService()
            req = ExtractionRequest(
                document_id=doc.id,
                template="invoice",
                custom_fields=["vendor", "invoice_number", "total_amount", "missing_discount_code"],
            )
            res = await service.extract_document(req, ws.id, session)

            assert res.document_id == str(doc.id)
            assert len(res.fields) > 0

            fields_dict = {f.field_name: f for f in res.fields}
            assert "vendor" in fields_dict
            assert fields_dict["vendor"].value is not None

            # Verify missing field maps to null and is recorded in missing_fields
            assert "missing_discount_code" in fields_dict
            assert fields_dict["missing_discount_code"].value is None
            assert "missing_discount_code" in res.missing_fields

            # Verify database persistence
            historical = await service.get_extractions_for_document(doc.id, ws.id, session)
            assert len(historical) >= 1
            assert historical[0].id == res.id

    asyncio.run(_test())


def test_table_intelligence_analysis():
    """Verify table analysis computes column statistics, missing cells, and row filtering."""
    raw_md = (
        "| Employee | Salary | Department |\n"
        "|---|---|---|\n"
        "| Alice | $120,000 | Engineering |\n"
        "| Bob | $110,000 | Engineering |\n"
        "| Charlie | $105,000 | Marketing |\n"
        "| David |  | Sales |\n"
    )

    tables = TableIntelligenceService.extract_tables_from_markdown(raw_md)
    assert len(tables) == 1

    tbl = tables[0]
    analysis = TableIntelligenceService.analyze_table(
        headers=tbl["headers"], rows=tbl["rows"], page_number=1, table_index=0
    )

    assert analysis.row_count == 4
    assert analysis.col_count == 3
    assert analysis.missing_cells_count == 1  # David has missing salary

    # Test row filtering
    eng_rows = TableIntelligenceService.filter_rows(
        headers=tbl["headers"], rows=tbl["rows"], column_name="Department", operator="equals", value="Engineering"
    )
    assert len(eng_rows) == 2
