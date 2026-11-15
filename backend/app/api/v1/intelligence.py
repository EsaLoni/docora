"""Intelligence API Endpoints.

Provides authenticated endpoints for:
- Document summarization (quick, detailed, section-wise, custom)
- Multi-document comparison & difference matrix
- Structured entity & custom field extraction
- Source-backed document insights
- Asynchronous durable job tracking & cancellation
- Multi-format exports (Markdown, JSON, CSV, PDF)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.document import Document
from app.models.intelligence import (
    DocumentComparison,
    DocumentInsight,
    DocumentSummary,
)
from app.models.user import User
from app.models.workspace import Workspace
from app.api.deps import get_active_workspace, get_current_user
from app.services.intelligence.export import IntelligenceExportService
from app.services.intelligence.models import (
    ComparisonRequest,
    ComparisonResponse,
    ExportRequest,
    ExtractionRequest,
    ExtractionResponse,
    InsightsRequest,
    InsightsResponse,
    IntelligenceJobResponse,
    SummaryRequest,
    SummaryResponse,
    TableAnalysisResult,
)
from app.services.intelligence.orchestrator import IntelligenceOrchestrator
from app.services.intelligence.table import TableIntelligenceService

logger = get_logger("api.intelligence")
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


class EnqueueResponse(BaseModel):
    job_id: str
    status: str
    job_type: str
    message: str


# -------------------------------------------------------------------------
# Summarization Endpoints
# -------------------------------------------------------------------------

@router.post("/summarize", response_model=Any)
async def summarize_document(
    request: SummaryRequest,
    async_job: bool = Query(False, description="Whether to enqueue as a durable background job"),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Generates or enqueues a document summary."""
    orchestrator = IntelligenceOrchestrator()
    if async_job:
        job = await orchestrator.enqueue_job(
            job_type="SUMMARIZE",
            document_ids=[request.document_id] + (request.additional_document_ids or []),
            parameters=request.model_dump(mode="json"),
            workspace_id=workspace.id,
            db=db,
        )
        return EnqueueResponse(
            job_id=job.job_id,
            status=job.status,
            job_type=job.job_type,
            message="Summarization job enqueued successfully.",
        )

    try:
        return await orchestrator.summarize(request, workspace.id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Error generating summary: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Summarization failed: {str(e)}",
        )


@router.get("/documents/{document_id}/summary", response_model=SummaryResponse)
async def get_document_summary(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieves the latest persisted summary for a document."""
    orchestrator = IntelligenceOrchestrator()
    summary = await orchestrator.summarization_service.get_latest_summary(
        document_id=document_id, workspace_id=workspace.id, db=db
    )
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No summary found for this document.",
        )
    return summary


# -------------------------------------------------------------------------
# Comparison Endpoints
# -------------------------------------------------------------------------

@router.post("/compare", response_model=Any)
async def compare_documents(
    request: ComparisonRequest,
    async_job: bool = Query(False, description="Whether to enqueue as a durable background job"),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Executes or enqueues a cross-document comparison."""
    if len(request.document_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Comparison requires at least two document IDs.",
        )

    orchestrator = IntelligenceOrchestrator()
    if async_job:
        job = await orchestrator.enqueue_job(
            job_type="COMPARE",
            document_ids=request.document_ids,
            parameters=request.model_dump(mode="json"),
            workspace_id=workspace.id,
            db=db,
        )
        return EnqueueResponse(
            job_id=job.job_id,
            status=job.status,
            job_type=job.job_type,
            message="Comparison job enqueued successfully.",
        )

    try:
        return await orchestrator.compare(request, workspace.id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Error comparing documents: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {str(e)}",
        )


# -------------------------------------------------------------------------
# Structured Extraction Endpoints
# -------------------------------------------------------------------------

@router.post("/extract", response_model=Any)
async def extract_structured_data(
    request: ExtractionRequest,
    async_job: bool = Query(False, description="Whether to enqueue as a durable background job"),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Executes or enqueues template-based or custom structured data extraction."""
    orchestrator = IntelligenceOrchestrator()
    if async_job:
        job = await orchestrator.enqueue_job(
            job_type="EXTRACT",
            document_ids=[request.document_id],
            parameters=request.model_dump(mode="json"),
            workspace_id=workspace.id,
            db=db,
        )
        return EnqueueResponse(
            job_id=job.job_id,
            status=job.status,
            job_type=job.job_type,
            message="Extraction job enqueued successfully.",
        )

    try:
        return await orchestrator.extract(request, workspace.id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Error extracting document data: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}",
        )


@router.get("/documents/{document_id}/extractions", response_model=List[ExtractionResponse])
async def get_document_extractions(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieves historical extractions for a document."""
    orchestrator = IntelligenceOrchestrator()
    return await orchestrator.extraction_service.get_extractions_for_document(
        document_id=document_id, workspace_id=workspace.id, db=db
    )


# -------------------------------------------------------------------------
# Document Insights Endpoints
# -------------------------------------------------------------------------

@router.post("/insights", response_model=Any)
async def generate_document_insights(
    request: InsightsRequest,
    async_job: bool = Query(False, description="Whether to enqueue as a durable background job"),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Generates or enqueues source-backed document insights."""
    orchestrator = IntelligenceOrchestrator()
    if async_job:
        job = await orchestrator.enqueue_job(
            job_type="INSIGHTS",
            document_ids=[request.document_id],
            parameters=request.model_dump(mode="json"),
            workspace_id=workspace.id,
            db=db,
        )
        return EnqueueResponse(
            job_id=job.job_id,
            status=job.status,
            job_type=job.job_type,
            message="Insights job enqueued successfully.",
        )

    try:
        return await orchestrator.generate_insights(request, workspace.id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("Error generating insights: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Insights generation failed: {str(e)}",
        )


@router.get("/documents/{document_id}/insights", response_model=InsightsResponse)
async def get_document_insights(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieves stored insights for a document."""
    orchestrator = IntelligenceOrchestrator()
    return await orchestrator.insights_service.get_insights_for_document(
        document_id=document_id, workspace_id=workspace.id, db=db
    )


# -------------------------------------------------------------------------
# Table Intelligence Endpoints
# -------------------------------------------------------------------------

class TableAnalysisRequest(BaseModel):
    markdown_table: str
    page_number: int = 1


@router.post("/tables/analyze", response_model=List[TableAnalysisResult])
async def analyze_table_markdown(
    request: TableAnalysisRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
):
    """Parses markdown table and returns column statistics and outlier detections."""
    tables = TableIntelligenceService.extract_tables_from_markdown(request.markdown_table)
    if not tables:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid markdown table detected in provided text.",
        )

    results = []
    for idx, tbl in enumerate(tables):
        res = TableIntelligenceService.analyze_table(
            headers=tbl["headers"],
            rows=tbl["rows"],
            page_number=request.page_number,
            table_index=idx,
        )
        results.append(res)
    return results


# -------------------------------------------------------------------------
# Job Management Endpoints
# -------------------------------------------------------------------------

@router.get("/jobs/{job_id}", response_model=IntelligenceJobResponse)
async def get_intelligence_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Queries current status and progress percentage of an intelligence job."""
    orchestrator = IntelligenceOrchestrator()
    job = await orchestrator.get_job_status(job_id, workspace.id, db)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intelligence job not found in active workspace.",
        )
    return job


@router.post("/jobs/{job_id}/cancel")
async def cancel_intelligence_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Cancels a pending or processing intelligence job."""
    orchestrator = IntelligenceOrchestrator()
    cancelled = await orchestrator.cancel_job(job_id, workspace.id, db)
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job cannot be cancelled (either not found, completed, or already cancelled).",
        )
    return {"message": "Job cancelled successfully."}


# -------------------------------------------------------------------------
# Export Endpoint
# -------------------------------------------------------------------------

@router.post("/export")
async def export_intelligence_artifact(
    request: ExportRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
):
    """Generates validated file downloads for summaries, comparisons, extractions, or insights."""
    payload = request.payload or {}
    export_type = request.export_type
    fmt = request.format.lower()

    # 1. If record_id provided, load from DB to verify workspace ownership
    if request.record_id:
        if export_type == "summary":
            s_stmt = select(DocumentSummary).where(
                DocumentSummary.id == request.record_id,
                DocumentSummary.workspace_id == workspace.id,
            )
            summary_rec = (await db.execute(s_stmt)).scalar_one_or_none()
            if not summary_rec:
                raise HTTPException(status_code=404, detail="Summary record not found.")
            payload = {
                "title": f"Summary ({summary_rec.summary_type.title()})",
                "content": summary_rec.summary_text,
                "citations": summary_rec.citations,
                "sections": summary_rec.structured_data.get("sections", []),
            }
        elif export_type == "comparison":
            c_stmt = select(DocumentComparison).where(
                DocumentComparison.id == request.record_id,
                DocumentComparison.workspace_id == workspace.id,
            )
            comp_rec = (await db.execute(c_stmt)).scalar_one_or_none()
            if not comp_rec:
                raise HTTPException(status_code=404, detail="Comparison record not found.")
            payload = {
                "title": f"Document Comparison ({comp_rec.comparison_type.title()})",
                "summary": comp_rec.summary_text,
                "differences": comp_rec.structured_differences,
            }

    # 2. Render based on requested format
    filename = f"udip_{export_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if fmt == "markdown":
        title = payload.get("title", f"UDIP {export_type.title()} Report")
        content = payload.get("content") or payload.get("summary", "")
        sections = payload.get("sections", [])
        citations = payload.get("citations", [])
        md_text = IntelligenceExportService.to_markdown(title, content, sections, citations)
        return Response(
            content=md_text,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
        )

    elif fmt == "json":
        json_text = IntelligenceExportService.to_json(payload)
        return Response(
            content=json_text,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )

    elif fmt == "csv":
        headers = []
        rows = []
        if export_type == "comparison":
            headers = ["Category", "Doc A Value", "Doc B Value", "Explanation", "Status", "Confidence"]
            for d in payload.get("differences", []):
                rows.append([
                    d.get("category", ""),
                    d.get("doc_a_value", ""),
                    d.get("doc_b_value", ""),
                    d.get("explanation", ""),
                    d.get("status", ""),
                    d.get("confidence", 1.0),
                ])
        elif export_type == "extraction":
            headers = ["Field Name", "Value", "Data Type", "Page", "Status", "Confidence"]
            for f in payload.get("fields", []):
                rows.append([
                    f.get("field_name", ""),
                    f.get("value", ""),
                    f.get("data_type", ""),
                    f.get("page_number", ""),
                    f.get("status", ""),
                    f.get("confidence", 1.0),
                ])
        else:
            headers = ["Metric", "Value"]
            for k, v in payload.items():
                if isinstance(v, (str, int, float, bool)):
                    rows.append([k, v])

        csv_text = IntelligenceExportService.to_csv(headers, rows)
        return Response(
            content=csv_text,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )

    elif fmt == "pdf":
        title = payload.get("title", f"UDIP {export_type.title()} Report")
        body_sections = []
        if "content" in payload:
            body_sections.append({"title": "Summary Content", "text": payload["content"]})
        if "summary" in payload:
            body_sections.append({"title": "Executive Summary", "text": payload["summary"]})
        for sec in payload.get("sections", []):
            body_sections.append({"title": sec.get("title", "Section"), "text": sec.get("text", "")})

        pdf_bytes = IntelligenceExportService.to_pdf(
            title=title,
            body_sections=body_sections,
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format: {fmt}. Must be pdf, markdown, csv, or json.",
        )
