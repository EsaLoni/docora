"""Document Upload, Management, and Download Endpoints.

Provides multi-stage secure file uploads, workspace-scoped library browsing,
HMAC-signed downloads, folder moving, and complete physical deletion.
"""

from datetime import datetime, timezone
import math
import os
from typing import Any, Dict, List, Optional
import urllib.parse
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace, get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.exceptions import ResourceNotFoundError, UDIPException
from app.core.logging import get_logger
from app.core.rate_limit import RateLimitDependency
from app.models.audit import AuditLog
from app.models.document import Document, DocumentPage
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Folder, Workspace
from app.services.storage import get_storage_adapter
from app.services.storage.local import LocalStorageAdapter
from app.services.storage.validator import FileValidator

logger = get_logger("api.documents")

router = APIRouter(prefix="/documents", tags=["Documents"])


class DocumentResponse(BaseModel):
    id: str
    workspace_id: str
    folder_id: Optional[str]
    title: str
    filename: str
    file_size_bytes: int
    mime_type: str
    status: str
    page_count: int
    created_at: str
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class PaginatedDocumentsResponse(BaseModel):
    items: List[DocumentResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int


class DocumentMoveRequest(BaseModel):
    folder_id: Optional[uuid.UUID] = None


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in_seconds: int


class ProcessingJobResponse(BaseModel):
    job_id: str
    document_id: str
    workspace_id: str
    job_type: str
    status: str
    progress_percentage: int
    retry_count: int
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str


class DocumentPageSummary(BaseModel):
    id: str
    page_number: int
    token_count: int
    has_images: bool
    ocr_applied: bool
    ocr_confidence: Optional[float] = None
    preview: str
    tables_count: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PaginatedPagesResponse(BaseModel):
    document_id: str
    total_pages: int
    page: int
    page_size: int
    items: List[DocumentPageSummary]


class DocumentPageDetailResponse(BaseModel):
    id: str
    document_id: str
    page_number: int
    content: str
    token_count: int
    has_images: bool
    ocr_applied: bool
    ocr_confidence: Optional[float] = None
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


upload_rate_limiter = RateLimitDependency(calls_per_minute=20, scope="upload")


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    _rl: None = Depends(upload_rate_limiter),
) -> DocumentResponse:
    """Securely upload and validate a new document into the active workspace."""
    # 1. Parse and validate folder_id if provided
    parsed_folder_id: Optional[uuid.UUID] = None
    if folder_id and folder_id.strip():
        try:
            parsed_folder_id = uuid.UUID(folder_id.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid folder_id format.")

        folder_stmt = select(Folder).where(
            Folder.id == parsed_folder_id,
            Folder.workspace_id == workspace.id,
        )
        folder = (await db.execute(folder_stmt)).scalar_one_or_none()
        if not folder:
            raise ResourceNotFoundError("Folder", str(parsed_folder_id))

    # 2. Read file content
    content = await file.read()

    # 3. Multi-stage security validation (magic bytes, extension, size, sanitization)
    validator = FileValidator(settings)
    validated = validator.validate(file.filename or "document.bin", content)

    # 4. Check workspace storage quota
    quota_stmt = select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    current_used_bytes = (await db.execute(quota_stmt)).scalar_one()

    # Workspace-specific quota or global default
    ws_quota = workspace.settings.get("storage_quota_bytes", settings.DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES)
    if current_used_bytes + validated.file_size_bytes > ws_quota:
        logger.warning(
            "Storage quota exceeded for workspace %s: used %d, incoming %d, limit %d",
            workspace.id, current_used_bytes, validated.file_size_bytes, ws_quota,
        )
        raise UDIPException(
            message=f"Workspace storage quota exceeded ({ws_quota / (1024 * 1024):.0f} MB limit). Please delete existing documents to free up space.",
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            error_code="STORAGE_QUOTA_EXCEEDED",
            details={"current_used_bytes": current_used_bytes, "quota_bytes": ws_quota},
        )

    # 5. Duplicate detection using SHA-256
    dup_stmt = select(Document).where(
        Document.workspace_id == workspace.id,
        Document.file_hash == validated.file_hash,
        Document.is_deleted == False,
    )
    dup = (await db.execute(dup_stmt)).scalars().first()
    if dup:
        logger.info("Duplicate document upload rejected: '%s' matches '%s'", validated.sanitized_filename, dup.title)
        raise UDIPException(
            message=f"A document with identical content already exists in this workspace: '{dup.title}'",
            status_code=status.HTTP_409_CONFLICT,
            error_code="DUPLICATE_DOCUMENT",
            details={"existing_document_id": str(dup.id), "existing_title": dup.title},
        )

    # 6. Persist file to storage adapter
    document_id = uuid.uuid4()
    storage_adapter = get_storage_adapter(settings)
    file_path: Optional[str] = None

    try:
        file_path = await storage_adapter.save_file(
            workspace_id=workspace.id,
            document_id=document_id,
            content=content,
            mime_type=validated.mime_type,
        )

        # 7. Create database master record
        title = validated.sanitized_filename
        if "." in title:
            title = title.rsplit(".", 1)[0]

        document = Document(
            id=document_id,
            workspace_id=workspace.id,
            folder_id=parsed_folder_id,
            user_id=current_user.id,
            title=title,
            filename=validated.sanitized_filename,
            file_path=file_path,
            file_size_bytes=validated.file_size_bytes,
            mime_type=validated.mime_type,
            file_hash=validated.file_hash,
            page_count=0,
            status="UPLOADED",
            metadata_json={
                "extension": validated.extension,
                "original_filename": file.filename,
                "uploaded_by_email": current_user.email,
            },
        )
        db.add(document)

        # 8. Queue background processing job
        job = ProcessingJob(
            workspace_id=workspace.id,
            document_id=document.id,
            job_type="FULL_INGESTION",
            status="QUEUED",
            progress_percentage=0,
        )
        db.add(job)

        # 9. Log audit event
        audit = AuditLog(
            workspace_id=workspace.id,
            user_id=current_user.id,
            action="DOCUMENT_UPLOAD",
            resource_type="document",
            resource_id=document.id,
            details={
                "filename": validated.sanitized_filename,
                "file_size_bytes": validated.file_size_bytes,
                "mime_type": validated.mime_type,
                "sha256": validated.file_hash,
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(document)
        logger.info("Successfully uploaded document '%s' (ID: %s)", document.title, document.id)

        return DocumentResponse(
            id=str(document.id),
            workspace_id=str(document.workspace_id),
            folder_id=str(document.folder_id) if document.folder_id else None,
            title=document.title,
            filename=document.filename,
            file_size_bytes=document.file_size_bytes,
            mime_type=document.mime_type,
            status=document.status,
            page_count=document.page_count,
            created_at=document.created_at.isoformat(),
            metadata_json=document.metadata_json,
        )

    except Exception as e:
        # Transactional rollback: Clean up physical file on disk/storage if database fails
        await db.rollback()
        if file_path:
            logger.warning("Rolling back physical storage file after upload error: %s", file_path)
            try:
                await storage_adapter.delete_file(file_path)
            except Exception as cleanup_err:
                logger.error("Failed to clean up orphaned storage file: %s", cleanup_err)
        raise e


@router.get("", response_model=PaginatedDocumentsResponse)
async def list_documents(
    folder_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedDocumentsResponse:
    """Browse documents scoped to active workspace with optional filtering and pagination."""
    # Build query
    filters = [
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    ]

    if folder_id:
        if folder_id.lower() == "root":
            filters.append(Document.folder_id.is_(None))
        else:
            try:
                fid = uuid.UUID(folder_id)
                filters.append(Document.folder_id == fid)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid folder_id.")

    if status:
        filters.append(Document.status == status.upper())

    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            (Document.title.ilike(term)) | (Document.filename.ilike(term))
        )

    # Count total matching
    count_stmt = select(func.count(Document.id)).where(*filters)
    total_count = (await db.execute(count_stmt)).scalar_one()

    # Query page
    offset = (page - 1) * page_size
    stmt = (
        select(Document)
        .where(*filters)
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    docs = result.scalars().all()

    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    return PaginatedDocumentsResponse(
        items=[
            DocumentResponse(
                id=str(d.id),
                workspace_id=str(d.workspace_id),
                folder_id=str(d.folder_id) if d.folder_id else None,
                title=d.title,
                filename=d.filename,
                file_size_bytes=d.file_size_bytes,
                mime_type=d.mime_type,
                status=d.status,
                page_count=d.page_count,
                created_at=d.created_at.isoformat(),
                metadata_json=d.metadata_json,
            )
            for d in docs
        ],
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentResponse:
    """Retrieve metadata for a specific document in the active workspace."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    return DocumentResponse(
        id=str(doc.id),
        workspace_id=str(doc.workspace_id),
        folder_id=str(doc.folder_id) if doc.folder_id else None,
        title=doc.title,
        filename=doc.filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        status=doc.status,
        page_count=doc.page_count,
        created_at=doc.created_at.isoformat(),
        metadata_json=doc.metadata_json,
    )


@router.get("/{document_id}/download", response_model=DownloadUrlResponse)
async def get_document_download_url(
    document_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> DownloadUrlResponse:
    """Generate a time-limited HMAC-signed URL for document download."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    storage_adapter = get_storage_adapter(settings)
    signed_url = await storage_adapter.get_signed_url(
        file_path=doc.file_path,
        filename=doc.filename,
        expires_in=settings.SIGNED_URL_EXPIRATION_SECONDS,
    )

    # Log audit event
    audit = AuditLog(
        workspace_id=workspace.id,
        user_id=current_user.id,
        action="DOCUMENT_DOWNLOAD",
        resource_type="document",
        resource_id=doc.id,
        details={"filename": doc.filename},
    )
    db.add(audit)
    await db.commit()

    return DownloadUrlResponse(
        download_url=signed_url,
        expires_in_seconds=settings.SIGNED_URL_EXPIRATION_SECONDS,
    )


@router.get("/download/stream")
async def download_document_stream(
    token: str = Query(...),
    sig: str = Query(...),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Stream file bytes for authenticated temporary signed URLs."""
    local_adapter = LocalStorageAdapter(settings)
    file_path, filename = local_adapter.verify_signed_token(token, sig)

    content = await local_adapter.read_file(file_path)

    # Infer or provide standard MIME
    ext = os.path.splitext(filename)[1].lower()
    from app.services.storage.validator import CANONICAL_MIME_TYPES
    media_type = CANONICAL_MIME_TYPES.get(ext, "application/octet-stream")

    encoded_filename = urllib.parse.quote(filename)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        "Content-Length": str(len(content)),
    }
    return Response(content=content, media_type=media_type, headers=headers)


@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: uuid.UUID,
    request: DocumentMoveRequest,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentResponse:
    """Move document to a different folder within the active workspace."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    if request.folder_id is not None:
        folder_stmt = select(Folder).where(
            Folder.id == request.folder_id,
            Folder.workspace_id == workspace.id,
        )
        folder = (await db.execute(folder_stmt)).scalar_one_or_none()
        if not folder:
            raise ResourceNotFoundError("Target Folder", str(request.folder_id))
        doc.folder_id = request.folder_id
    else:
        doc.folder_id = None

    await db.commit()
    await db.refresh(doc)

    return DocumentResponse(
        id=str(doc.id),
        workspace_id=str(doc.workspace_id),
        folder_id=str(doc.folder_id) if doc.folder_id else None,
        title=doc.title,
        filename=doc.filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        status=doc.status,
        page_count=doc.page_count,
        created_at=doc.created_at.isoformat(),
        metadata_json=doc.metadata_json,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> None:
    """Completely purge a document from database and physical storage."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    # 1. Delete physical file from storage
    storage_adapter = get_storage_adapter(settings)
    await storage_adapter.delete_file(doc.file_path)

    # 2. Record audit log
    audit = AuditLog(
        workspace_id=workspace.id,
        user_id=current_user.id,
        action="DOCUMENT_DELETE",
        resource_type="document",
        resource_id=doc.id,
        details={"title": doc.title, "filename": doc.filename},
    )
    db.add(audit)

    # 3. Delete database record (cascading deletes pages, chunks, jobs, extractions, citations)
    await db.delete(doc)
    await db.commit()
    logger.info("Purged document '%s' (ID: %s) from workspace %s", doc.title, doc.id, workspace.id)


@router.get("/{document_id}/processing", response_model=ProcessingJobResponse)
async def get_document_processing_status(
    document_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ProcessingJobResponse:
    """Retrieve the current or latest ingestion processing job for a document."""
    doc_stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(doc_stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    job_stmt = (
        select(ProcessingJob)
        .where(
            ProcessingJob.document_id == document_id,
            ProcessingJob.workspace_id == workspace.id,
        )
        .order_by(ProcessingJob.created_at.desc())
        .limit(1)
    )
    job = (await db.execute(job_stmt)).scalar_one_or_none()

    if not job:
        # Return synthetic status matching current document status
        return ProcessingJobResponse(
            job_id=str(uuid.uuid4()),
            document_id=str(doc.id),
            workspace_id=str(workspace.id),
            job_type="FULL_INGESTION",
            status="COMPLETED" if doc.status == "READY" else doc.status,
            progress_percentage=100 if doc.status == "READY" else 0,
            retry_count=0,
            error_message=doc.processing_error,
            started_at=None,
            completed_at=None,
            created_at=doc.created_at.isoformat(),
        )

    return ProcessingJobResponse(
        job_id=str(job.id),
        document_id=str(job.document_id),
        workspace_id=str(job.workspace_id),
        job_type=job.job_type,
        status=job.status,
        progress_percentage=job.progress_percentage,
        retry_count=job.retry_count,
        error_message=job.error_message,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        created_at=job.created_at.isoformat(),
    )


@router.post("/{document_id}/process", response_model=ProcessingJobResponse)
async def trigger_document_processing(
    document_id: uuid.UUID,
    background: bool = Query(True, description="Execute in background or wait for completion"),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ProcessingJobResponse:
    """Trigger or retry document extraction and ingestion pipeline."""
    from app.services.worker.processor import DocumentProcessor

    doc_stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(doc_stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    # Create or requeue job
    job = ProcessingJob(
        workspace_id=workspace.id,
        document_id=doc.id,
        job_type="FULL_INGESTION",
        status="QUEUED",
        progress_percentage=0,
    )
    db.add(job)
    doc.status = "PROCESSING"
    doc.processing_error = None
    await db.commit()
    await db.refresh(job)

    storage_adapter = get_storage_adapter(settings)
    processor = DocumentProcessor(settings)

    if not background:
        # Synchronous execution
        await processor.process_job(job.id, db, storage_adapter)
        await db.refresh(job)
    else:
        # Background execution
        import asyncio
        from app.core.database import get_async_session_factory

        async def _run_bg(j_id: uuid.UUID) -> None:
            session_factory = get_async_session_factory(settings)
            async with session_factory() as bg_db:
                await processor.process_job(j_id, bg_db, storage_adapter)

        asyncio.create_task(_run_bg(job.id))

    return ProcessingJobResponse(
        job_id=str(job.id),
        document_id=str(job.document_id),
        workspace_id=str(job.workspace_id),
        job_type=job.job_type,
        status=job.status,
        progress_percentage=job.progress_percentage,
        retry_count=job.retry_count,
        error_message=job.error_message,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        created_at=job.created_at.isoformat(),
    )


@router.get("/{document_id}/pages", response_model=PaginatedPagesResponse)
async def list_document_pages(
    document_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number for pagination"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedPagesResponse:
    """Retrieve paginated list of extracted pages for a document."""
    doc_stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(doc_stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    # Total pages count
    count_stmt = select(func.count(DocumentPage.id)).where(
        DocumentPage.document_id == document_id
    )
    total_pages = (await db.execute(count_stmt)).scalar_one()

    # Fetch page items
    offset = (page - 1) * page_size
    pages_stmt = (
        select(DocumentPage)
        .where(DocumentPage.document_id == document_id)
        .order_by(DocumentPage.page_number.asc())
        .offset(offset)
        .limit(page_size)
    )
    pages = (await db.execute(pages_stmt)).scalars().all()

    items = []
    for p in pages:
        meta = p.metadata_json or {}
        preview_text = p.content[:200] + "..." if len(p.content) > 200 else p.content
        items.append(
            DocumentPageSummary(
                id=str(p.id),
                page_number=p.page_number,
                token_count=p.token_count,
                has_images=p.has_images,
                ocr_applied=p.ocr_applied,
                ocr_confidence=meta.get("ocr_confidence"),
                preview=preview_text,
                tables_count=len(meta.get("tables", [])),
                metadata=meta,
            )
        )

    return PaginatedPagesResponse(
        document_id=str(document_id),
        total_pages=total_pages,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/{document_id}/pages/{page_number}", response_model=DocumentPageDetailResponse)
async def get_document_page_detail(
    document_id: uuid.UUID,
    page_number: int,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentPageDetailResponse:
    """Retrieve detailed content, tables, and metadata for a specific document page."""
    doc_stmt = select(Document).where(
        Document.id == document_id,
        Document.workspace_id == workspace.id,
        Document.is_deleted == False,
    )
    doc = (await db.execute(doc_stmt)).scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundError("Document", str(document_id))

    page_stmt = select(DocumentPage).where(
        DocumentPage.document_id == document_id,
        DocumentPage.page_number == page_number,
    )
    doc_page = (await db.execute(page_stmt)).scalar_one_or_none()
    if not doc_page:
        raise ResourceNotFoundError("Document Page", f"{document_id} / Page {page_number}")

    meta = doc_page.metadata_json or {}
    tables = meta.get("tables", [])

    return DocumentPageDetailResponse(
        id=str(doc_page.id),
        document_id=str(doc_page.document_id),
        page_number=doc_page.page_number,
        content=doc_page.content,
        token_count=doc_page.token_count,
        has_images=doc_page.has_images,
        ocr_applied=doc_page.ocr_applied,
        ocr_confidence=meta.get("ocr_confidence"),
        tables=tables,
        metadata=meta,
        created_at=doc_page.created_at.isoformat(),
    )
