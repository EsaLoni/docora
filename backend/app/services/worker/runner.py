"""Durable Background Worker Runner.

Polls for QUEUED processing jobs, executes them through DocumentProcessor and
IntelligenceProcessor, and handles graceful shutdown on process termination.
Designed for headless deployment as an independent background worker
(e.g., Render Background Worker) completely decoupled from FastAPI HTTP processes.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import signal
import sys
from typing import Any, List, Optional
import uuid
from sqlalchemy import and_, or_, select
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

    def __init__(
        self,
        settings: Optional[Settings] = None,
        session_factory: Optional[Any] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.session_factory = session_factory or get_async_session_factory(self.settings)
        self.processor = DocumentProcessor(self.settings)
        self.intelligence_processor = IntelligenceProcessor(self.settings)
        self.reminder_scheduler = ReminderScheduler()
        self.storage_adapter = get_storage_adapter(self.settings)
        self.concurrency = self.settings.WORKER_CONCURRENCY
        self._semaphore = asyncio.Semaphore(self.concurrency)
        self._running = False
        self._worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        self._jobs_processed_total = 0

    def _write_heartbeat(self) -> None:
        """Write heartbeat status to file for orchestrator liveness probes."""
        filepath = self.settings.WORKER_HEALTHCHECK_FILE
        if not filepath:
            return
        try:
            now = datetime.now(timezone.utc)
            data = {
                "status": "healthy" if self._running else "stopped",
                "worker_id": self._worker_id,
                "timestamp": now.isoformat(),
                "epoch": now.timestamp(),
                "running": self._running,
                "jobs_processed": self._jobs_processed_total,
                "concurrency": self.concurrency,
            }
            target = Path(filepath)
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = target.with_suffix(".tmp")
            tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            tmp_path.replace(target)
        except Exception as e:
            logger.debug("Failed to write worker heartbeat: %s", e)

    async def recover_stale_jobs(self, timeout_minutes: Optional[int] = None) -> int:
        """Recovers any jobs interrupted by a server restart or crash.

        Only jobs that have been in PROCESSING state longer than timeout_minutes
        (defaults to settings.WORKER_STALE_JOB_TIMEOUT_MINUTES) are recovered.
        Active jobs within the timeout window are NOT touched.
        """
        timeout = timeout_minutes if timeout_minutes is not None else self.settings.WORKER_STALE_JOB_TIMEOUT_MINUTES
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout)
        recovered_count = 0
        async with self.session_factory() as db:
            # 1. Stale ingestion jobs
            ingest_stmt = select(ProcessingJob).where(
                ProcessingJob.status == "PROCESSING",
                or_(
                    ProcessingJob.started_at < cutoff,
                    and_(ProcessingJob.started_at.is_(None), ProcessingJob.created_at < cutoff),
                ),
            )
            stale_ingest = (await db.execute(ingest_stmt)).scalars().all()
            for job in stale_ingest:
                job.retry_count += 1
                if job.retry_count < self.settings.WORKER_MAX_RETRIES:
                    job.status = "QUEUED"
                    job.progress_percentage = 0
                    job.error_message = f"Recovered stale job after {timeout}m timeout (attempt {job.retry_count}/{self.settings.WORKER_MAX_RETRIES})."
                    logger.warning("Recovered stale ingestion job %s (attempt %d/%d) -> re-queued", job.id, job.retry_count, self.settings.WORKER_MAX_RETRIES)
                else:
                    job.status = "FAILED"
                    job.completed_at = datetime.now(timezone.utc)
                    job.error_message = f"Job stalled and exhausted max retries ({self.settings.WORKER_MAX_RETRIES})."
                    logger.warning("Stale ingestion job %s exceeded max retries -> marked FAILED", job.id)
                recovered_count += 1

            # 2. Stale intelligence jobs
            intel_stmt = select(IntelligenceJob).where(
                IntelligenceJob.status == "PROCESSING",
                or_(
                    IntelligenceJob.started_at < cutoff,
                    and_(IntelligenceJob.started_at.is_(None), IntelligenceJob.created_at < cutoff),
                ),
            )
            stale_intel = (await db.execute(intel_stmt)).scalars().all()
            for ijob in stale_intel:
                ijob.retry_count += 1
                if ijob.retry_count < self.settings.WORKER_MAX_RETRIES:
                    ijob.status = "QUEUED"
                    ijob.progress_percentage = 0
                    ijob.error_message = f"Recovered stale job after {timeout}m timeout (attempt {ijob.retry_count}/{self.settings.WORKER_MAX_RETRIES})."
                    logger.warning("Recovered stale intelligence job %s (attempt %d/%d) -> re-queued", ijob.id, ijob.retry_count, self.settings.WORKER_MAX_RETRIES)
                else:
                    ijob.status = "FAILED"
                    ijob.completed_at = datetime.now(timezone.utc)
                    ijob.error_message = f"Job stalled and exhausted max retries ({self.settings.WORKER_MAX_RETRIES})."
                    logger.warning("Stale intelligence job %s exceeded max retries -> marked FAILED", ijob.id)
                recovered_count += 1

            if recovered_count > 0:
                await db.commit()

        return recovered_count

    async def claim_ingestion_jobs(self, limit: int) -> List[uuid.UUID]:
        """Atomically claim up to limit QUEUED ingestion jobs using FOR UPDATE SKIP LOCKED.

        Immediately marks them PROCESSING and commits so no competing worker can claim them.
        """
        claimed: List[uuid.UUID] = []
        async with self.session_factory() as db:
            stmt = (
                select(ProcessingJob)
                .where(ProcessingJob.status == "QUEUED")
                .order_by(ProcessingJob.created_at.asc())
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            jobs = (await db.execute(stmt)).scalars().all()
            now = datetime.now(timezone.utc)
            for job in jobs:
                job.status = "PROCESSING"
                job.started_at = now
                job.progress_percentage = 5
                claimed.append(job.id)
            if claimed:
                await db.commit()
        return claimed

    async def claim_intelligence_jobs(self, limit: int) -> List[uuid.UUID]:
        """Atomically claim up to limit QUEUED intelligence jobs using FOR UPDATE SKIP LOCKED.

        Immediately marks them PROCESSING and commits so no competing worker can claim them.
        """
        claimed: List[uuid.UUID] = []
        async with self.session_factory() as db:
            stmt = (
                select(IntelligenceJob)
                .where(IntelligenceJob.status == "QUEUED")
                .order_by(IntelligenceJob.created_at.asc())
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            jobs = (await db.execute(stmt)).scalars().all()
            now = datetime.now(timezone.utc)
            for job in jobs:
                job.status = "PROCESSING"
                job.started_at = now
                job.progress_percentage = 5
                claimed.append(job.id)
            if claimed:
                await db.commit()
        return claimed

    async def process_next_batch(self, batch_size: Optional[int] = None) -> int:
        """Atomically claim and execute up to batch_size ingestion and intelligence jobs."""
        limit = batch_size if batch_size is not None else self.settings.WORKER_BATCH_SIZE
        processed_count = 0

        # 1. Claim and process ingestion jobs
        ingest_job_ids = await self.claim_ingestion_jobs(limit)
        for job_id in ingest_job_ids:
            if not self._running:
                break
            logger.info("Worker %s processing claimed ingestion job %s", self._worker_id, job_id)
            async with self.session_factory() as db:
                async with self._semaphore:
                    metrics.set_active_worker_jobs(1)
                    success = await self.processor.process_job(job_id, db, self.storage_adapter)
                    metrics.set_active_worker_jobs(0)
            status_str = "completed" if success else "failed"
            metrics.record_worker_job("ingestion", status_str)
            if success:
                processed_count += 1
                self._jobs_processed_total += 1

        # 2. Claim and process intelligence jobs with remaining slots
        remaining_slots = limit - len(ingest_job_ids)
        if remaining_slots > 0 and self._running:
            intel_job_ids = await self.claim_intelligence_jobs(remaining_slots)
            for ijob_id in intel_job_ids:
                if not self._running:
                    break
                logger.info("Worker %s processing claimed intelligence job %s", self._worker_id, ijob_id)
                async with self.session_factory() as db:
                    async with self._semaphore:
                        metrics.set_active_worker_jobs(1)
                        success = await self.intelligence_processor.process_job(ijob_id, db)
                        metrics.set_active_worker_jobs(0)
                status_str = "completed" if success else "failed"
                metrics.record_worker_job("intelligence", status_str)
                if success:
                    processed_count += 1
                    self._jobs_processed_total += 1

        # 3. Process due reminders
        if self._running:
            try:
                async with self.session_factory() as db:
                    reminders_sent = await self.reminder_scheduler.dispatch_due_reminders(db)
                    if reminders_sent > 0:
                        logger.info("Worker dispatched %d due reminders", reminders_sent)
            except Exception as e:
                logger.error("Error dispatching due reminders in worker: %s", e)

        return processed_count

    async def run(self, poll_interval_seconds: Optional[float] = None) -> None:
        """Continuous polling loop with periodic stale recovery and health heartbeat."""
        poll_interval = (
            poll_interval_seconds
            if poll_interval_seconds is not None
            else self.settings.WORKER_POLL_INTERVAL_SECONDS
        )
        self._running = True
        logger.info(
            "Worker runner %s started (concurrency: %d, poll: %.1fs, stale_timeout: %dm)",
            self._worker_id,
            self.concurrency,
            poll_interval,
            self.settings.WORKER_STALE_JOB_TIMEOUT_MINUTES,
        )

        # Recover any crashed jobs on startup
        try:
            recovered = await self.recover_stale_jobs()
            if recovered > 0:
                logger.info("Startup recovered %d stale jobs", recovered)
        except Exception as e:
            logger.error("Error during stale job recovery on startup: %s", e)

        # Periodic stale recovery interval: check every ~60 seconds
        loop_counter = 0
        stale_check_interval_loops = max(1, int(60 / max(poll_interval, 0.5)))

        while self._running:
            self._write_heartbeat()
            try:
                processed = await self.process_next_batch()

                loop_counter += 1
                if loop_counter >= stale_check_interval_loops:
                    loop_counter = 0
                    try:
                        await self.recover_stale_jobs()
                    except Exception as e:
                        logger.error("Error during periodic stale job recovery: %s", e)

                if processed == 0 and self._running:
                    await asyncio.sleep(poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Unexpected worker loop error: %s", e)
                if self._running:
                    await asyncio.sleep(poll_interval)

        self._write_heartbeat()
        logger.info("Worker runner %s stopped cleanly.", self._worker_id)
        from app.core.database import close_db_connections
        await close_db_connections()

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

    def handle_shutdown(signum, frame=None):
        logger.info("Received shutdown signal %s, stopping worker...", signum)
        runner.stop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, runner.stop)
        except (NotImplementedError, RuntimeError):
            # Windows signal handler fallback
            try:
                signal.signal(sig, handle_shutdown)
            except (ValueError, AttributeError):
                pass

    try:
        loop.run_until_complete(runner.run())
    except KeyboardInterrupt:
        runner.stop()
    finally:
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()


if __name__ == "__main__":
    main()
