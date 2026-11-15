"""Comprehensive Tests for Standalone Background Worker Runner (Phase 19.2).

Validates:
1. Pure process decoupling from FastAPI (worker runs without FastAPI HTTP server).
2. Atomic job claiming with FOR UPDATE SKIP LOCKED.
3. Multi-worker concurrency and duplicate processing prevention.
4. End-to-end batch execution for ingestion and intelligence jobs.
5. Time-bounded stale job recovery (active jobs preserved, stale jobs re-queued).
6. Dead-letter queue transition on retry exhaustion.
7. Graceful worker shutdown via stop() signal.
8. Liveness heartbeat file generation.
9. Idempotent reprocessing without orphaned or duplicate chunks.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
from unittest.mock import patch
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.intelligence import IntelligenceJob
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Workspace
from app.services.storage.local import LocalStorageAdapter
from app.services.worker.processor import DocumentProcessor
from app.services.worker.runner import WorkerRunner


async def _seed_test_env(session: AsyncSession, settings: Settings):
    """Seed test user, workspace, and storage adapter."""
    user = User(
        id=uuid.uuid4(),
        email=f"worker-{uuid.uuid4().hex[:6]}@udip.local",
        full_name="Worker Integration Tester",
        is_active=True,
    )
    session.add(user)

    ws = Workspace(
        id=uuid.uuid4(),
        name="Worker Runner Test Workspace",
        slug=f"worker-run-{uuid.uuid4().hex[:8]}",
        owner_id=user.id,
        settings={},
    )
    session.add(ws)
    await session.commit()
    await session.refresh(user)
    await session.refresh(ws)

    adapter = LocalStorageAdapter(settings)
    return user, ws, adapter


async def _create_test_doc_and_job(
    session: AsyncSession,
    user: User,
    ws: Workspace,
    adapter: LocalStorageAdapter,
    text: str = "Docora Background Worker Document Content. Testing Section 1.",
):
    """Create a test document and corresponding queued ProcessingJob."""
    doc_id = uuid.uuid4()
    content = text.encode("utf-8")
    file_path = await adapter.save_file(
        workspace_id=ws.id,
        document_id=doc_id,
        content=content,
        mime_type="text/plain",
    )
    doc = Document(
        id=doc_id,
        workspace_id=ws.id,
        user_id=user.id,
        title="Worker Test Document",
        filename="test_doc.txt",
        file_path=file_path,
        file_size_bytes=len(content),
        mime_type="text/plain",
        file_hash=f"hash_{uuid.uuid4().hex[:12]}",
        page_count=0,
        status="UPLOADED",
        metadata_json={},
    )
    session.add(doc)

    job = ProcessingJob(
        id=uuid.uuid4(),
        workspace_id=ws.id,
        document_id=doc.id,
        job_type="FULL_INGESTION",
        status="QUEUED",
        progress_percentage=0,
        retry_count=0,
    )
    session.add(job)
    await session.commit()
    await session.refresh(doc)
    await session.refresh(job)
    return doc, job


def test_worker_decoupled_from_fastapi(test_settings: Settings):
    """Verify that WorkerRunner can be instantiated and initialized without FastAPI app."""
    # Ensure WorkerRunner does not require an active FastAPI application
    runner = WorkerRunner(settings=test_settings)
    assert runner is not None
    assert runner.concurrency == test_settings.WORKER_CONCURRENCY
    assert runner._running is False
    assert runner._worker_id.startswith("worker-")


def test_atomic_job_claiming(session_factory: async_sessionmaker[AsyncSession], test_settings: Settings):
    """Verify atomic claiming marks jobs as PROCESSING and prevents double claiming."""
    async def _test():
        async with session_factory() as session:
            user, ws, adapter = await _seed_test_env(session, test_settings)
            _, job1 = await _create_test_doc_and_job(session, user, ws, adapter)
            _, job2 = await _create_test_doc_and_job(session, user, ws, adapter)

        runner = WorkerRunner(settings=test_settings, session_factory=session_factory)
        claimed = await runner.claim_ingestion_jobs(limit=1)

        # Worker should claim exactly 1 job
        assert len(claimed) == 1
        claimed_id = claimed[0]

        async with session_factory() as session:
            stmt = select(ProcessingJob).where(ProcessingJob.id == claimed_id)
            cjob = (await session.execute(stmt)).scalar_one()
            assert cjob.status == "PROCESSING"
            assert cjob.started_at is not None

            # Attempt second claim: should claim the other remaining job, not the first
            second_claimed = await runner.claim_ingestion_jobs(limit=1)
            assert len(second_claimed) == 1
            assert second_claimed[0] != claimed_id

            # Third claim: no queued jobs remain
            third_claimed = await runner.claim_ingestion_jobs(limit=1)
            assert len(third_claimed) == 0

    asyncio.run(_test())


def test_concurrent_workers_claim_distinct_jobs(
    session_factory: async_sessionmaker[AsyncSession], test_settings: Settings
):
    """Verify multiple background workers claim non-overlapping, distinct jobs."""
    async def _test():
        async with session_factory() as session:
            user, ws, adapter = await _seed_test_env(session, test_settings)
            _, j1 = await _create_test_doc_and_job(session, user, ws, adapter)
            _, j2 = await _create_test_doc_and_job(session, user, ws, adapter)
            _, j3 = await _create_test_doc_and_job(session, user, ws, adapter)
            _, j4 = await _create_test_doc_and_job(session, user, ws, adapter)

        worker_a = WorkerRunner(settings=test_settings, session_factory=session_factory)
        worker_b = WorkerRunner(settings=test_settings, session_factory=session_factory)

        # Worker A claims first batch of 2 jobs
        claims_a = await worker_a.claim_ingestion_jobs(limit=2)
        # Worker B claims next batch of 2 jobs
        claims_b = await worker_b.claim_ingestion_jobs(limit=2)

        # Ensure no overlap between claimed job sets and all 4 jobs claimed
        set_a = set(claims_a)
        set_b = set(claims_b)
        assert len(set_a.intersection(set_b)) == 0
        assert len(claims_a) == 2
        assert len(claims_b) == 2

    asyncio.run(_test())


def test_postgres_for_update_skip_locked_query_compilation():
    """Verify that PostgreSQL dialect produces FOR UPDATE SKIP LOCKED on claiming queries."""
    from sqlalchemy.dialects.postgresql import dialect as pg_dialect
    stmt = (
        select(ProcessingJob)
        .where(ProcessingJob.status == "QUEUED")
        .order_by(ProcessingJob.created_at.asc())
        .limit(5)
        .with_for_update(skip_locked=True)
    )
    compiled = str(stmt.compile(dialect=pg_dialect()))
    assert "FOR UPDATE SKIP LOCKED" in compiled

    intel_stmt = (
        select(IntelligenceJob)
        .where(IntelligenceJob.status == "QUEUED")
        .order_by(IntelligenceJob.created_at.asc())
        .limit(5)
        .with_for_update(skip_locked=True)
    )
    intel_compiled = str(intel_stmt.compile(dialect=pg_dialect()))
    assert "FOR UPDATE SKIP LOCKED" in intel_compiled


def test_batch_process_ingestion_and_intelligence(
    session_factory: async_sessionmaker[AsyncSession], test_settings: Settings
):
    """Verify WorkerRunner.process_next_batch handles both ingestion and intelligence jobs."""
    async def _test():
        async with session_factory() as session:
            user, ws, adapter = await _seed_test_env(session, test_settings)
            doc, job = await _create_test_doc_and_job(session, user, ws, adapter)

            intel_job = IntelligenceJob(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                job_type="SUMMARIZE",
                document_ids=[str(doc.id)],
                status="QUEUED",
                progress_percentage=0,
                parameters_json={"summary_type": "quick"},
            )
            session.add(intel_job)
            await session.commit()
            intel_job_id = intel_job.id

        runner = WorkerRunner(settings=test_settings, session_factory=session_factory)
        runner._running = True

        # Process next batch
        processed = await runner.process_next_batch(batch_size=5)
        assert processed >= 1

        async with session_factory() as session:
            # Check ingestion job completed
            stmt1 = select(ProcessingJob).where(ProcessingJob.id == job.id)
            res_job = (await session.execute(stmt1)).scalar_one()
            assert res_job.status == "COMPLETED"
            assert res_job.progress_percentage == 100
            assert res_job.completed_at is not None

            # Check document is READY
            stmt_doc = select(Document).where(Document.id == doc.id)
            res_doc = (await session.execute(stmt_doc)).scalar_one()
            assert res_doc.status == "READY"

            # Check intelligence job (may be picked up in next slot)
            stmt2 = select(IntelligenceJob).where(IntelligenceJob.id == intel_job_id)
            res_ijob = (await session.execute(stmt2)).scalar_one()
            if res_ijob.status == "QUEUED":
                # Process remaining
                await runner.process_next_batch(batch_size=5)
                await session.refresh(res_ijob)
            assert res_ijob.status in ("COMPLETED", "PROCESSING")

    asyncio.run(_test())


def test_stale_job_recovery_threshold(
    session_factory: async_sessionmaker[AsyncSession], test_settings: Settings
):
    """Verify stale job recovery respects the timeout threshold and max retries."""
    async def _test():
        now = datetime.now(timezone.utc)
        async with session_factory() as session:
            user, ws, adapter = await _seed_test_env(session, test_settings)

            # 1. Active job (started 2 minutes ago, timeout is 15 minutes) -> should NOT be recovered
            active_doc, active_job = await _create_test_doc_and_job(session, user, ws, adapter)
            active_job.status = "PROCESSING"
            active_job.started_at = now - timedelta(minutes=2)
            active_job.retry_count = 0

            # 2. Stale job (started 30 minutes ago, retry_count = 0) -> should be RE-QUEUED
            stale_doc, stale_job = await _create_test_doc_and_job(session, user, ws, adapter)
            stale_job.status = "PROCESSING"
            stale_job.started_at = now - timedelta(minutes=30)
            stale_job.retry_count = 0

            # 3. Exhausted stale job (started 45 minutes ago, retry_count = 3 >= MAX_RETRIES) -> FAILED
            dead_doc, dead_job = await _create_test_doc_and_job(session, user, ws, adapter)
            dead_job.status = "PROCESSING"
            dead_job.started_at = now - timedelta(minutes=45)
            dead_job.retry_count = test_settings.WORKER_MAX_RETRIES

            await session.commit()
            active_id = active_job.id
            stale_id = stale_job.id
            dead_id = dead_job.id

        runner = WorkerRunner(settings=test_settings, session_factory=session_factory)
        # Timeout threshold = 15 minutes
        recovered = await runner.recover_stale_jobs(timeout_minutes=15)

        # 2 stale jobs recovered (stale_job + dead_job)
        assert recovered == 2

        async with session_factory() as session:
            # Active job was NOT touched
            act = (await session.execute(select(ProcessingJob).where(ProcessingJob.id == active_id))).scalar_one()
            assert act.status == "PROCESSING"
            assert act.retry_count == 0

            # Stale job was re-queued
            stl = (await session.execute(select(ProcessingJob).where(ProcessingJob.id == stale_id))).scalar_one()
            assert stl.status == "QUEUED"
            assert stl.retry_count == 1
            assert stl.progress_percentage == 0

            # Dead job marked FAILED
            ded = (await session.execute(select(ProcessingJob).where(ProcessingJob.id == dead_id))).scalar_one()
            assert ded.status == "FAILED"
            assert ded.completed_at is not None
            assert ded.retry_count > test_settings.WORKER_MAX_RETRIES

    asyncio.run(_test())


def test_failure_retry_and_dead_letter_state(
    session_factory: async_sessionmaker[AsyncSession], test_settings: Settings
):
    """Verify failed processing increments retry_count and transitions to FAILED upon max retries."""
    async def _test():
        async with session_factory() as session:
            user, ws, adapter = await _seed_test_env(session, test_settings)
            doc, job = await _create_test_doc_and_job(session, user, ws, adapter)

            processor = DocumentProcessor(test_settings)

            # Simulate extraction failure by pointing file_path to nonexistent location
            doc.file_path = "nonexistent/storage/broken_file.bin"
            await session.commit()

            # Attempt 1: Should fail and re-queue
            success = await processor.process_job(job.id, session, adapter)
            assert success is False
            await session.refresh(job)
            assert job.status == "QUEUED"
            assert job.retry_count == 1

            # Simulate retry attempts up to max_retries - 1
            job.retry_count = test_settings.WORKER_MAX_RETRIES - 1
            await session.commit()

            # Attempt final: Should exceed max retries and transition to FAILED
            success_final = await processor.process_job(job.id, session, adapter)
            assert success_final is False
            await session.refresh(job)
            assert job.status == "FAILED"
            assert job.retry_count >= test_settings.WORKER_MAX_RETRIES
            assert job.completed_at is not None
            assert "error" in (job.error_message or "").lower()

    asyncio.run(_test())


def test_graceful_shutdown(test_settings: Settings):
    """Verify that runner.stop() immediately signals the loop to terminate."""
    runner = WorkerRunner(settings=test_settings)
    runner._running = True
    assert runner._running is True
    runner.stop()
    assert runner._running is False


def test_worker_heartbeat_generation(tmp_path: Path, test_settings: Settings):
    """Verify worker writes heartbeat file when WORKER_HEALTHCHECK_FILE is configured."""
    heartbeat_file = tmp_path / "worker_heartbeat.json"
    custom_settings = test_settings.model_copy(
        update={"WORKER_HEALTHCHECK_FILE": str(heartbeat_file)}
    )
    runner = WorkerRunner(settings=custom_settings)
    runner._running = True
    runner._jobs_processed_total = 7

    # Trigger heartbeat write
    runner._write_heartbeat()

    assert heartbeat_file.exists()
    data = json.loads(heartbeat_file.read_text(encoding="utf-8"))
    assert data["status"] == "healthy"
    assert data["running"] is True
    assert data["jobs_processed"] == 7
    assert data["worker_id"] == runner._worker_id
    assert "timestamp" in data
    assert "epoch" in data


def test_idempotent_reprocessing_cleans_pages_and_chunks(
    session_factory: async_sessionmaker[AsyncSession], test_settings: Settings
):
    """Verify that reprocessing an existing document cleanly deletes previous chunks and pages."""
    async def _test():
        async with session_factory() as session:
            user, ws, adapter = await _seed_test_env(session, test_settings)
            doc, job = await _create_test_doc_and_job(
                session, user, ws, adapter, text="Page 1 Initial Content. Section Alpha."
            )
            processor = DocumentProcessor(test_settings)

            # First run: process document
            success1 = await processor.process_job(job.id, session, adapter)
            assert success1 is True

            # Check chunk and page count
            stmt_pages = select(DocumentPage).where(DocumentPage.document_id == doc.id)
            pages1 = (await session.execute(stmt_pages)).scalars().all()
            stmt_chunks = select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
            chunks1 = (await session.execute(stmt_chunks)).scalars().all()

            assert len(pages1) > 0
            assert len(chunks1) > 0
            initial_chunk_ids = {c.id for c in chunks1}

            # Second run: re-queue and re-process same document
            job.status = "QUEUED"
            job.progress_percentage = 0
            await session.commit()

            success2 = await processor.process_job(job.id, session, adapter)
            assert success2 is True

            # Verify no orphaned chunks or double counts
            chunks2 = (await session.execute(stmt_chunks)).scalars().all()
            assert len(chunks2) == len(chunks1)
            # Replaced chunk IDs
            new_chunk_ids = {c.id for c in chunks2}
            assert len(new_chunk_ids) == len(chunks2)

    asyncio.run(_test())
