"""Intelligence Orchestrator.

Central facade coordinating document summarization, multi-document comparison,
structured extraction, insights generation, and asynchronous job tracking.
Enforces workspace tenant boundaries and manages durable jobs.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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
    ComparisonResponse,
    ExtractionRequest,
    ExtractionResponse,
    InsightsRequest,
    InsightsResponse,
    IntelligenceJobResponse,
    SummaryRequest,
    SummaryResponse,
)
from app.services.intelligence.summarization import SummarizationService
from app.services.llm.service import LLMService

logger = get_logger("intelligence.orchestrator")


class IntelligenceOrchestrator:
    """Coordinates all advanced intelligence domain services."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        llm_service: Optional[LLMService] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.llm_service = llm_service or LLMService(settings=self.settings)
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

    # -------------------------------------------------------------------------
    # Synchronous Immediate Execution
    # -------------------------------------------------------------------------

    async def summarize(
        self,
        request: SummaryRequest,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> SummaryResponse:
        """Executes document summarization directly."""
        return await self.summarization_service.summarize_document(
            request=request, workspace_id=workspace_id, db=db
        )

    async def compare(
        self,
        request: ComparisonRequest,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> ComparisonResponse:
        """Executes multi-document comparison directly."""
        return await self.comparison_service.compare_documents(
            request=request, workspace_id=workspace_id, db=db
        )

    async def extract(
        self,
        request: ExtractionRequest,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> ExtractionResponse:
        """Executes structured information extraction directly."""
        return await self.extraction_service.extract_document(
            request=request, workspace_id=workspace_id, db=db
        )

    async def generate_insights(
        self,
        request: InsightsRequest,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> InsightsResponse:
        """Executes automated document insights directly."""
        return await self.insights_service.generate_insights(
            request=request, workspace_id=workspace_id, db=db
        )

    # -------------------------------------------------------------------------
    # Asynchronous Durable Job Dispatch & Lifecycle
    # -------------------------------------------------------------------------

    async def enqueue_job(
        self,
        job_type: str,
        document_ids: List[uuid.UUID],
        parameters: Dict[str, Any],
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> IntelligenceJobResponse:
        """Enqueues a durable background job into intelligence_jobs table."""
        job = IntelligenceJob(
            workspace_id=workspace_id,
            job_type=job_type,
            document_ids=[str(did) for did in document_ids],
            status="QUEUED",
            progress_percentage=0,
            parameters_json=parameters,
            retry_count=0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        logger.info("Enqueued %s job %s for workspace %s", job_type, job.id, workspace_id)
        return self._to_job_response(job)

    async def get_job_status(
        self,
        job_id: uuid.UUID,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> Optional[IntelligenceJobResponse]:
        """Queries status of an intelligence job within the active workspace."""
        stmt = select(IntelligenceJob).where(
            IntelligenceJob.id == job_id,
            IntelligenceJob.workspace_id == workspace_id,
        )
        job = (await db.execute(stmt)).scalar_one_or_none()
        if not job:
            return None
        return self._to_job_response(job)

    async def cancel_job(
        self,
        job_id: uuid.UUID,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> bool:
        """Cancels a pending or processing job."""
        stmt = select(IntelligenceJob).where(
            IntelligenceJob.id == job_id,
            IntelligenceJob.workspace_id == workspace_id,
        )
        job = (await db.execute(stmt)).scalar_one_or_none()
        if not job:
            return False

        if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
            return False

        job.status = "CANCELLED"
        job.error_message = "Job cancelled by user request."
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return True

    @staticmethod
    def _to_job_response(job: IntelligenceJob) -> IntelligenceJobResponse:
        """Converts ORM IntelligenceJob to DTO."""
        return IntelligenceJobResponse(
            job_id=str(job.id),
            job_type=job.job_type,
            document_ids=job.document_ids or [],
            status=job.status,
            progress_percentage=job.progress_percentage,
            created_at=job.created_at.isoformat(),
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
            error_message=job.error_message,
            result=job.result_json,
        )
