"""Tests for Multi-Document Comparison Service."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.intelligence.comparison import ComparisonService
from app.services.intelligence.models import ComparisonRequest
from app.services.intelligence.table import TableIntelligenceService


def test_two_document_comparison(session_factory: async_sessionmaker[AsyncSession]):
    """Verify comparison across two documents generates common themes and structured differences."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            doc_a = Document(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                user_id=user.id,
                title="Fiscal Proposal 2024",
                filename="proposal_2024.pdf",
                file_path="mock/path/proposal_2024.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="hash_a",
                page_count=1,
                status="READY",
            )
            doc_b = Document(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                user_id=user.id,
                title="Fiscal Proposal 2025",
                filename="proposal_2025.pdf",
                file_path="mock/path/proposal_2025.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="hash_b",
                page_count=1,
                status="READY",
            )
            session.add_all([doc_a, doc_b])
            await session.flush()

            pa = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc_a.id,
                page_number=1,
                content="Infrastructure budget allocated at $500,000. Project target completion date is 2024-12-31.",
            )
            pb = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc_b.id,
                page_number=1,
                content="Infrastructure budget expanded to $750,000. Revised milestone completion date is 2025-03-31.",
            )
            session.add_all([pa, pb])
            await session.commit()

            service = ComparisonService()
            req = ComparisonRequest(document_ids=[doc_a.id, doc_b.id], comparison_type="comprehensive")
            res = await service.compare_documents(req, ws.id, session)

            assert len(res.document_ids) == 2
            assert len(res.summary_text) > 0
            assert len(res.differences) > 0

            diff = res.differences[0]
            assert diff.category is not None
            assert diff.status in ["conflicting", "missing", "verified", "matching"]
            assert diff.confidence > 0.0

    asyncio.run(_test())


def test_table_comparison():
    """Verify table comparison across documents detects value and existence changes."""
    table_a = {
        "headers": ["Department", "Headcount", "Budget"],
        "rows": [
            ["Engineering", "25", "$2,500,000"],
            ["Marketing", "10", "$800,000"],
        ],
    }
    table_b = {
        "headers": ["Department", "Headcount", "Budget"],
        "rows": [
            ["Engineering", "30", "$3,000,000"],
            ["Sales", "15", "$1,200,000"],
        ],
    }

    diffs = TableIntelligenceService.compare_tables(table_a, table_b, "Report 2023", "Report 2024")
    assert len(diffs) > 0

    # Engineering budget change
    eng_diff = next((d for d in diffs if "Engineering" in d.get("category", "")), None)
    assert eng_diff is not None
    assert eng_diff["status"] == "conflicting"

    # Marketing row missing in B
    mktg_diff = next((d for d in diffs if "Marketing" in d.get("doc_a_value", "")), None)
    assert mktg_diff is not None
    assert mktg_diff["status"] == "missing"


def test_comparison_workspace_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify documents from different workspaces cannot be compared."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws_a = Workspace(id=uuid.uuid4(), name="Workspace A", slug=f"ws-a-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            ws_b = Workspace(id=uuid.uuid4(), name="Workspace B", slug=f"ws-b-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws_a, ws_b])
            await session.flush()

            doc_a = Document(
                id=uuid.uuid4(),
                workspace_id=ws_a.id,
                user_id=user.id,
                title="Workspace A Doc",
                filename="doc_a.pdf",
                file_path="mock/path/doc_a.pdf",
                file_size_bytes=512,
                mime_type="application/pdf",
                file_hash="hash_a_iso",
                page_count=1,
                status="READY",
            )
            doc_b_foreign = Document(
                id=uuid.uuid4(),
                workspace_id=ws_b.id,  # Different tenant workspace
                user_id=user.id,
                title="Foreign Tenant Doc",
                filename="doc_foreign.pdf",
                file_path="mock/path/doc_foreign.pdf",
                file_size_bytes=512,
                mime_type="application/pdf",
                file_hash="hash_foreign",
                page_count=1,
                status="READY",
            )
            session.add_all([doc_a, doc_b_foreign])
            await session.commit()

            service = ComparisonService()
            req = ComparisonRequest(document_ids=[doc_a.id, doc_b_foreign.id])
            try:
                await service.compare_documents(req, ws_a.id, session)
                assert False, "Should have raised ValueError"
            except ValueError as e:
                assert "not found in active workspace" in str(e)

    asyncio.run(_test())
