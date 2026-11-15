"""Durable Background Worker Runner.

Polls for QUEUED processing jobs, executes them through DocumentProcessor,
and handles graceful shutdown on process termination.
"""

import asyncio
import signal
import sys
from typing import Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_async_session_factory
from app.core.logging import get_logger
from app.core.metrics import metrics
from app.models.document import Document
from app.models.intelligence import IntelligenceJob
from app.models.processing_job import ProcessingJob
from app.services.actions.scheduler import ReminderScheduler
from app.services.storage import get_storage_adapter
from app.services.worker.intelligence_processor import IntelligenceProcessor
from app.services.worker.processor import DocumentProcessor

logger = get_logger("worker.runner")


class WorkerRunner:
    """Asynchronous polling ingestion and intelligence worker."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.processor = DocumentProcessor(self.settings)
        self.intelligence_processor = IntelligenceProcessor(self.settings)
        self.reminder_scheduler = ReminderScheduler()
        self.storage_adapter = get_storage_adapter(self.settings)
        self.concurrency = self.settings.WORKER_CONCURRENCY
        self._semaphore = asyncio.Semaphore(self.concurrency)
        self._running = False

    async def recover_stale_jobs(self) -> int:
        """Recovers any jobs interrupted by a server restart or crash."""
        session_factory = get_async_session_factory(self.settings)
        recovered_count = 0
        async with session_factory() as db:
            # 1. Stale ingestion jobs
            ingest_stmt = select(ProcessingJob).where(ProcessingJob.status == "PROCESSING")
            stale_ingest = (await db.execute(ingest_stmt)).scalars().all()
            for job in stale_ingest:
                job.retry_count += 1
                if job.retry_count < DocumentProcessor.MAX_RETRIES:
                    job.status = "QUEUED"
                    job.progress_percentage = 0
                    logger.warning("Recovered stale ingestion job %s -> re-queued", job.id)
                else:
                    job.status = "FAILED"
                    job.error_message = "Job stalled across worker restart."
                recovered_count += 1

            # 2. Stale intelligence jobs
            intel_stmt = select(IntelligenceJob).where(IntelligenceJob.status == "PROCESSING")
            stale_intel = (await db.execute(intel_stmt)).scalars().all()
            for ijob in stale_intel:
                ijob.retry_count += 1
                if ijob.retry_count < IntelligenceProcessor.MAX_RETRIES:
                    ijob.status = "QUEUED"
                    ijob.progress_percentage = 0
                    logger.warning("Recovered stale intelligence job %s -> re-queued", ijob.id)
                else:
                    ijob.status = "FAILED"
                    ijob.error_message = "Job stalled across worker restart."
                recovered_count += 1

            if recovered_count > 0:
                await db.commit()

        return recovered_count

    async def process_next_batch(self, batch_size: int = 5) -> int:
        """Find and execute up to batch_size QUEUED ingestion or intelligence jobs."""
        session_factory = get_async_session_factory(self.settings)
        async with session_factory() as db:
            processed_count = 0

            # 1. Ingestion jobs (FOR UPDATE SKIP LOCKED prevents race conditions across concurrent workers)
            stmt = (
                select(ProcessingJob)
                .where(ProcessingJob.status == "QUEUED")
                .order_by(ProcessingJob.created_at.asc())
                .limit(batch_size)
                .with_for_update(skip_locked=True)
            )
            jobs = (await db.execute(stmt)).scalars().all()

            for job in jobs:
                if not self._running:
                    break
                logger.info("Worker picked up ingestion job %s (document: %s)", job.id, job.document_id)
                async with self._semaphore:
                    metrics.set_active_worker_jobs(1)
                    success = await self.processor.process_job(job.id, db, self.storage_adapter)
                    metrics.set_active_worker_jobs(0)
                status_str = "completed" if success else "failed"
                metrics.record_worker_job("ingestion", status_str)
                if success:
                    processed_count += 1

            # 2. Intelligence jobs
            remaining_slots = batch_size - processed_count
            if remaining_slots > 0:
                intel_stmt = (
                    select(IntelligenceJob)
                    .where(IntelligenceJob.status == "QUEUED")
                    .order_by(IntelligenceJob.created_at.asc())
                    .limit(remaining_slots)
                    .with_for_update(skip_locked=True)
                )
                intel_jobs = (await db.execute(intel_stmt)).scalars().all()
                for ijob in intel_jobs:
                    if not self._running:
                        break
                    logger.info("Worker picked up intelligence job %s (%s)", ijob.id, ijob.job_type)
                    async with self._semaphore:
                        metrics.set_active_worker_jobs(1)
                        success = await self.intelligence_processor.process_job(ijob.id, db)
                        metrics.set_active_worker_jobs(0)
                    status_str = "completed" if success else "failed"
                    metrics.record_worker_job("intelligence", status_str)
                    if success:
                        processed_count += 1

            # 3. Process due reminders
            try:
                reminders_sent = await self.reminder_scheduler.dispatch_due_reminders(db)
                if reminders_sent > 0:
                    logger.info("Worker dispatched %d due reminders", reminders_sent)
            except Exception as e:
                logger.error("Error dispatching due reminders in worker: %s", e)

            return processed_count

    async def run(self, poll_interval_seconds: float = 2.0) -> None:
        """Continuous polling loop."""
        self._running = True
        logger.info("Worker runner started (polling every %.1fs)", poll_interval_seconds)

        # Recover any crashed jobs on startup
        try:
            await self.recover_stale_jobs()
        except Exception as e:
            logger.error("Error during stale job recovery on startup: %s", e)

        while self._running:
            try:
                processed = await self.process_next_batch()
                if processed == 0:
                    await asyncio.sleep(poll_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Unexpected worker loop error: %s", e)
                await asyncio.sleep(poll_interval_seconds)

        logger.info("Worker runner stopped cleanly.")

    def stop(self) -> None:
        """Signal worker to stop processing after current item."""
        self._running = False


async def process_document_now(
    document_id: uuid.UUID,
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Execute ingestion immediately for a document (used by direct API triggers or background tasks)."""
    settings = get_settings()
    processor = DocumentProcessor(settings)
    storage_adapter = get_storage_adapter(settings)

    # Find the latest or active job for this document
    stmt = (
        select(ProcessingJob)
        .where(
            ProcessingJob.document_id == document_id,
            ProcessingJob.workspace_id == workspace_id,
        )
        .order_by(ProcessingJob.created_at.desc())
        .limit(1)
    )
    job = (await db.execute(stmt)).scalar_one_or_none()

    if not job or job.status in ("COMPLETED", "FAILED"):
        # Create a new job if none exists or previous failed
        job = ProcessingJob(
            workspace_id=workspace_id,
            document_id=document_id,
            job_type="FULL_INGESTION",
            status="QUEUED",
            progress_percentage=0,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

    return await processor.process_job(job.id, db, storage_adapter)


async def process_intelligence_job_now(
    job_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Execute intelligence job immediately."""
    settings = get_settings()
    processor = IntelligenceProcessor(settings)
    return await processor.process_job(job_id, db)


def main() -> None:
    """CLI entrypoint for standalone background worker process."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    runner = WorkerRunner()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, runner.stop)
        except (NotImplementedError, RuntimeError):
            # Windows signal handler fallback
            try:
                signal.signal(sig, lambda s, f: runner.stop())
            except (ValueError, AttributeError):
                pass

    try:
        loop.run_until_complete(runner.run())
    except KeyboardInterrupt:
        runner.stop()
    finally:
        loop.close()


if __name__ == "__main__":
    main()
