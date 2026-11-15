"""Tests for Document Summarization Service."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.intelligence.models import SummaryRequest
from app.services.intelligence.summarization import SummarizationService


def test_quick_summary(session_factory: async_sessionmaker[AsyncSession]):
    """Verify quick summary generation with key findings, facts, and citations."""
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
                title="Quarterly Earnings Report",
                filename="earnings_q3.pdf",
                file_path="mock/path/earnings_q3.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="mockhash123",
                page_count=2,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="Quarterly revenue reached $45.2M, representing 14% growth year-over-year. Operating expenses were kept flat at $12.5M.",
            )
            p2 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=2,
                content="Net profit margins expanded to 22%. Customer acquisition costs declined by 8% due to organic enterprise referrals.",
            )
            session.add_all([p1, p2])
            await session.commit()

            service = SummarizationService()
            req = SummaryRequest(document_id=doc.id, summary_type="quick")
            res = await service.summarize_document(req, ws.id, session)

            assert res.document_id == str(doc.id)
            assert res.summary_type == "quick"
            assert len(res.summary_text) > 0
            assert len(res.key_findings) > 0
            assert len(res.citations) > 0
            assert res.citations[0]["filename"] == "earnings_q3.pdf"

    asyncio.run(_test())


def test_detailed_summary(session_factory: async_sessionmaker[AsyncSession]):
    """Verify detailed summary creates structured executive summary, sections, and dates/numbers."""
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
                title="Architecture Blueprint",
                filename="arch_v2.pdf",
                file_path="mock/path/arch_v2.pdf",
                file_size_bytes=2048,
                mime_type="application/pdf",
                file_hash="mockhash456",
                page_count=2,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="# System Architecture\nAsynchronous background ingestion pipeline processes complex multi-page files with zero main thread blocking.",
            )
            p2 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=2,
                content="# Security Compliance\nTarget launch date: December 31, 2026. Infrastructure budget: $500,000.",
            )
            session.add_all([p1, p2])
            await session.commit()

            service = SummarizationService()
            req = SummaryRequest(document_id=doc.id, summary_type="detailed")
            res = await service.summarize_document(req, ws.id, session)

            assert res.summary_type == "detailed"
            assert res.executive_summary is not None
            assert len(res.sections) > 0
            assert len(res.important_dates_and_numbers) > 0

    asyncio.run(_test())


def test_section_wise_summary(session_factory: async_sessionmaker[AsyncSession]):
    """Verify section-wise summary preserves headings and page lineage."""
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
                title="Technical Manual",
                filename="manual.pdf",
                file_path="mock/path/manual.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="mockhash789",
                page_count=2,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="### Introduction\nThis section explains the system initialization sequence.",
            )
            p2 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=2,
                content="### Diagnostic Codes\nCodes 101 through 105 indicate connection timeouts.",
            )
            session.add_all([p1, p2])
            await session.commit()

            service = SummarizationService()
            req = SummaryRequest(document_id=doc.id, summary_type="section_wise")
            res = await service.summarize_document(req, ws.id, session)

            assert res.summary_type == "section_wise"
            assert len(res.sections) == 2
            assert res.sections[0].page_number == 1
            assert res.sections[1].page_number == 2

    asyncio.run(_test())


def test_custom_summary(session_factory: async_sessionmaker[AsyncSession]):
    """Verify custom summary executes user guidance instructions."""
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
                title="Project Risk Assessment",
                filename="risks.docx",
                file_path="mock/path/risks.docx",
                file_size_bytes=1024,
                mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                file_hash="mockhash999",
                page_count=1,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="High operational risk identified in single database replica. Mitigation strategy requires multi-region backup.",
            )
            session.add(p1)
            await session.commit()

            service = SummarizationService()
            req = SummaryRequest(
                document_id=doc.id,
                summary_type="custom",
                custom_instruction="Summarize only operational risks and required mitigations for executive leadership.",
            )
            res = await service.summarize_document(req, ws.id, session)

            assert res.summary_type == "custom"
            assert len(res.summary_text) > 0

    asyncio.run(_test())


def test_summarization_workspace_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify user in workspace A cannot summarize documents in workspace B."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws_a = Workspace(id=uuid.uuid4(), name="Workspace A", slug=f"ws-a-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            ws_b = Workspace(id=uuid.uuid4(), name="Workspace B", slug=f"ws-b-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws_a, ws_b])
            await session.flush()

            doc = Document(
                id=uuid.uuid4(),
                workspace_id=ws_b.id,
                user_id=user.id,
                title="Private Tenant Document",
                filename="tenant_b.pdf",
                file_path="mock/path/tenant_b.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="mockhash_iso",
                page_count=1,
                status="READY",
            )
            session.add(doc)
            await session.commit()

            service = SummarizationService()
            req = SummaryRequest(document_id=doc.id, summary_type="quick")
            try:
                await service.summarize_document(req, ws_a.id, session)
                assert False, "Should have raised ValueError"
            except ValueError as e:
                assert "not found in workspace" in str(e)

    asyncio.run(_test())
