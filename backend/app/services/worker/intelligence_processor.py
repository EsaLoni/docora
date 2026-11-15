"""Durable Intelligence Job Processor.

Executes asynchronous summarization, multi-document comparison, structured extraction,
and document insights tasks with persistent progress updates, retries, and error tracking.
"""

from datetime import datetime, timezone
import traceback
from typing import Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models.intelligence import IntelligenceJob
from app.services.intelligence.comparison import ComparisonService
from app.services.intelligence.extraction import StructuredExtractionService
from app.services.intelligence.insights import InsightsService
from app.services.intelligence.models import (
    ComparisonRequest,
    ExtractionRequest,
    InsightsRequest,
    SummaryRequest,
)
from app.services.intelligence.summarization import SummarizationService
from app.services.llm.service import LLMService

logger = get_logger("worker.intelligence_processor")


class IntelligenceProcessor:
    """Processes asynchronous heavy intelligence jobs with atomic state transitions."""

    MAX_RETRIES = 3

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.llm_service = LLMService(settings=self.settings)
        self.summarization_service = SummarizationService(
            settings=self.settings, llm_service=self.llm_service
        )
        self.comparison_service = ComparisonService(
            settings=self.settings, llm_service=self.llm_service
        )
        self.extraction_service = StructuredExtractionService(
            settings=self.settings, llm_service=self.llm_service
        )
        self.insights_service = InsightsService(
            settings=self.settings, llm_service=self.llm_service
        )

    async def process_job(self, job_id: uuid.UUID, db: AsyncSession) -> bool:
        """Executes a single IntelligenceJob end-to-end with progress and retry handling."""
        # 1. Fetch job record
        stmt = select(IntelligenceJob).where(IntelligenceJob.id == job_id)
        job = (await db.execute(stmt)).scalar_one_or_none()
        if not job:
            logger.error("Intelligence job %s not found.", job_id)
            return False

        if job.status == "COMPLETED":
            logger.info("Intelligence job %s is already completed.", job_id)
            return True

        if job.status == "CANCELLED":
            logger.info("Intelligence job %s was cancelled. Skipping.", job_id)
            return False

        # 2. Atomic state transition: QUEUED -> PROCESSING
        job.status = "PROCESSING"
        job.started_at = datetime.now(timezone.utc)
        job.progress_percentage = 15
        job.error_message = None
        await db.commit()

        try:
            params = job.parameters_json or {}
            doc_uuids = [uuid.UUID(did) for did in job.document_ids]
            workspace_id = job.workspace_id

            # 3. Route according to job_type
            if job.job_type == "SUMMARIZE":
                if not doc_uuids:
                    raise ValueError("Summarize job requires at least one document ID.")
                job.progress_percentage = 40
                await db.commit()

                req = SummaryRequest(
                    document_id=doc_uuids[0],
                    summary_type=params.get("summary_type", "quick"),
                    custom_instruction=params.get("custom_instruction"),
                    additional_document_ids=doc_uuids[1:] if len(doc_uuids) > 1 else None,
                )
                res = await self.summarization_service.summarize_document(
                    req, workspace_id, db
                )
                job.result_json = res.model_dump()

            elif job.job_type == "COMPARE":
                if len(doc_uuids) < 2:
                    raise ValueError("Comparison job requires at least two document IDs.")
                job.progress_percentage = 40
                await db.commit()

                req = ComparisonRequest(
                    document_ids=doc_uuids,
                    comparison_type=params.get("comparison_type", "comprehensive"),
                    custom_prompt=params.get("custom_prompt"),
                )
                res = await self.comparison_service.compare_documents(
                    req, workspace_id, db
                )
                job.result_json = res.model_dump()

            elif job.job_type == "EXTRACT":
                if not doc_uuids:
                    raise ValueError("Extraction job requires at least one document ID.")
                job.progress_percentage = 40
                await db.commit()

                req = ExtractionRequest(
                    document_id=doc_uuids[0],
                    template=params.get("template", "entities"),
                    custom_fields=params.get("custom_fields"),
                )
                res = await self.extraction_service.extract_document(
                    req, workspace_id, db
                )
                job.result_json = res.model_dump()

            elif job.job_type == "INSIGHTS":
                if not doc_uuids:
                    raise ValueError("Insights job requires at least one document ID.")
                job.progress_percentage = 40
                await db.commit()

                req = InsightsRequest(
                    document_id=doc_uuids[0],
                    focus_areas=params.get("focus_areas"),
                )
                res = await self.insights_service.generate_insights(
                    req, workspace_id, db
                )
                job.result_json = res.model_dump()

            else:
                raise ValueError(f"Unsupported intelligence job type: {job.job_type}")

            # 4. Success completion
            job.status = "COMPLETED"
            job.progress_percentage = 100
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("Intelligence job %s (%s) completed successfully.", job_id, job.job_type)
            return True

        except Exception as e:
            logger.error("Error processing intelligence job %s: %s\n%s", job_id, e, traceback.format_exc())
            job.retry_count += 1
            if job.retry_count < self.MAX_RETRIES:
                job.status = "QUEUED"
                job.progress_percentage = 0
                job.error_message = f"Retry {job.retry_count}/{self.MAX_RETRIES}: {str(e)}"
            else:
                job.status = "FAILED"
                job.progress_percentage = 0
                job.error_message = f"Failed after {self.MAX_RETRIES} attempts: {str(e)}"
                job.completed_at = datetime.now(timezone.utc)

            await db.commit()
            return False
