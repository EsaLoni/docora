"""Tests for Intelligence Background Worker Processing, Recovery, and Retries."""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document, DocumentPage
from app.models.intelligence import IntelligenceJob
from app.models.user import User
from app.models.workspace import Workspace
from app.services.worker.intelligence_processor import IntelligenceProcessor
from app.services.worker.runner import WorkerRunner


def test_intelligence_job_lifecycle(session_factory: async_sessionmaker[AsyncSession]):
    """Verify asynchronous job lifecycle from QUEUED -> PROCESSING -> COMPLETED."""
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
                title="Quarterly Strategy",
                filename="strategy.pdf",
                file_path="mock/path/strategy.pdf",
                file_size_bytes=1024,
                mime_type="application/pdf",
                file_hash="hash_strat",
                page_count=1,
                status="READY",
            )
            session.add(doc)
            await session.flush()

            p1 = DocumentPage(
                id=uuid.uuid4(),
                document_id=doc.id,
                page_number=1,
                content="Quarterly strategy focuses on automated document intelligence and cloud scalability.",
            )
            session.add(p1)

            # Create Queued IntelligenceJob
            job = IntelligenceJob(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                job_type="SUMMARIZE",
                document_ids=[str(doc.id)],
                status="QUEUED",
                progress_percentage=0,
                parameters_json={"summary_type": "quick"},
            )
            session.add(job)
            await session.commit()

            # Process job via processor
            processor = IntelligenceProcessor()
            success = await processor.process_job(job.id, session)
            assert success is True

            # Verify status transition in DB
            await session.refresh(job)
            assert job.status == "COMPLETED"
            assert job.progress_percentage == 100
            assert job.completed_at is not None
            assert job.result_json is not None
            assert "summary_text" in job.result_json

    asyncio.run(_test())


def test_worker_runner_stale_job_recovery(session_factory: async_sessionmaker[AsyncSession]):
    """Verify worker runner recovers stalled jobs on startup/recovery trigger."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            stale_job = IntelligenceJob(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                job_type="SUMMARIZE",
                document_ids=[str(uuid.uuid4())],
                status="PROCESSING",  # Stalled from hypothetical process crash
                progress_percentage=30,
                parameters_json={"summary_type": "quick"},
                retry_count=0,
            )
            session.add(stale_job)
            await session.commit()

            runner = WorkerRunner(session_factory=session_factory)
            # Stale timeout 0 minutes ensures any past job in PROCESSING is recovered
            recovered = await runner.recover_stale_jobs(timeout_minutes=0)
            assert recovered == 1

            await session.refresh(stale_job)
            assert stale_job.status == "QUEUED"
            assert stale_job.retry_count == 1
            assert stale_job.progress_percentage == 0

    asyncio.run(_test())
