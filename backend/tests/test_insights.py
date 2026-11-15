"""Tests for Document Insights Engine."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.intelligence.insights import InsightsService
from app.services.intelligence.models import InsightsRequest


def test_generate_document_insights(session_factory: async_sessionmaker[AsyncSession]):
    """Verify source-backed insights generation with fact vs interpretation labeling."""
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
                title="Operations Audit",
                filename="audit.pdf",
                file_path="mock/path/audit.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="hash_audit",
                page_count=2,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="Asynchronous background ingestion pipeline processes complex multi-page files with zero main-thread blocking.",
            )
            p2 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=2,
                content="Workspace-level isolation must be strictly enforced on all queries to mitigate data exposure.",
            )
            session.add_all([p1, p2])
            await session.commit()

            service = InsightsService()
            req = InsightsRequest(document_id=doc.id)
            res = await service.generate_insights(req, ws.id, session)

            assert res.document_id == str(doc.id)
            assert res.total_insights > 0

            categories = {ins.category for ins in res.insights}
            assert "directly_extracted_fact" in categories or "llm_interpretation" in categories

            for ins in res.insights:
                assert ins.evidence_text is not None
                assert ins.page_number is not None
                assert len(ins.citations) > 0

            persisted = await service.get_insights_for_document(doc.id, ws.id, session)
            assert persisted.total_insights == res.total_insights

    asyncio.run(_test())


def test_insights_workspace_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify tenant isolation prevents extracting insights from foreign workspaces."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws_a = Workspace(id=uuid.uuid4(), name="Workspace A", slug=f"ws-a-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            ws_b = Workspace(id=uuid.uuid4(), name="Workspace B", slug=f"ws-b-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws_a, ws_b])
            await session.flush()

            doc_foreign = Document(
                id=uuid.uuid4(),
                workspace_id=ws_b.id,
                user_id=user.id,
                title="Secret Blueprint",
                filename="secret.pdf",
                file_path="mock/path/secret.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="hash_secret",
                page_count=1,
                status="READY",
            )
            session.add(doc_foreign)
            await session.commit()

            service = InsightsService()
            req = InsightsRequest(document_id=doc_foreign.id)
            try:
                await service.generate_insights(req, ws_a.id, session)
                assert False, "Should have raised ValueError"
            except ValueError as e:
                assert "not found in workspace" in str(e)

    asyncio.run(_test())
