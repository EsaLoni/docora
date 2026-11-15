"""Durable Ingestion Document Processor.

Executes atomic status transitions, document retrieval via StorageAdapter,
extraction via DocumentExtractorFactory, idempotent page writes, intelligent chunking,
vector embedding generation, and vector persistence.
"""

from datetime import datetime, timezone
import traceback
from typing import Optional
import uuid
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models.audit import AuditLog
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.processing_job import ProcessingJob
from app.services.chunking.service import ChunkingService
from app.services.embeddings.service import EmbeddingService
from app.services.extractors.factory import DocumentExtractorFactory
from app.services.storage.base import StorageAdapter

logger = get_logger("worker.processor")


class DocumentProcessor:
    """Handles the ingestion pipeline for a single document processing job."""

    MAX_RETRIES = 3

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.max_retries = getattr(self.settings, "WORKER_MAX_RETRIES", self.MAX_RETRIES)
        self.chunking_service = ChunkingService(settings=self.settings)
        self.embedding_service = EmbeddingService(settings=self.settings)

    async def process_job(
        self,
        job_id: uuid.UUID,
        db: AsyncSession,
        storage_adapter: StorageAdapter,
    ) -> bool:
        """Process a specific ProcessingJob end-to-end through extraction, chunking, and embeddings."""
        # 1. Fetch job
        job_stmt = select(ProcessingJob).where(ProcessingJob.id == job_id)
        job = (await db.execute(job_stmt)).scalar_one_or_none()
        if not job:
            logger.error("Processing job %s not found.", job_id)
            return False

        if job.status == "COMPLETED":
            logger.info("Job %s is already completed. Skipping.", job_id)
            return True

        # Fetch associated document
        doc_stmt = select(Document).where(Document.id == job.document_id)
        document = (await db.execute(doc_stmt)).scalar_one_or_none()
        if not document or document.is_deleted:
            logger.error("Document for job %s not found or deleted.", job_id)
            job.status = "FAILED"
            job.error_message = "Associated document was deleted or not found."
            await db.commit()
            return False

        # 2. Atomic state transition: QUEUED -> PROCESSING
        job.status = "PROCESSING"
        job.started_at = datetime.now(timezone.utc)
        job.progress_percentage = 10
        document.status = "PROCESSING"
        document.processing_error = None
        await db.commit()

        try:
            # 3. Read file bytes from storage adapter
            file_bytes = await storage_adapter.read_file(document.file_path)
            if not file_bytes:
                raise ValueError("Retrieved empty file payload from storage.")

            job.progress_percentage = 25
            await db.commit()

            # 4. Resolve extractor and parse
            extractor = DocumentExtractorFactory.get_extractor(
                mime_type=document.mime_type,
                filename=document.filename,
            )
            result = await extractor.extract(
                file_bytes=file_bytes,
                filename=document.filename,
                mime_type=document.mime_type,
            )

            job.progress_percentage = 50
            await db.commit()

            if not result.success:
                raise ValueError(result.error_message or "Extraction reported failure.")

            # 5. Idempotent write: clean existing pages and chunks for this document first
            await db.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
            )
            await db.execute(
                delete(DocumentPage).where(DocumentPage.document_id == document.id)
            )
            await db.flush()

            # 6. Insert new DocumentPage records
            created_pages: list[DocumentPage] = []
            for p in result.pages:
                page_meta = {
                    **p.metadata,
                    "ocr_applied": p.ocr_applied,
                    "ocr_confidence": p.ocr_confidence,
                    "warnings": p.warnings,
                    "tables": [t.model_dump() for t in p.tables],
                }
                page_model = DocumentPage(
                    document_id=document.id,
                    page_number=p.page_number,
                    content=p.content,
                    token_count=p.token_count,
                    has_images=p.has_images,
                    ocr_applied=p.ocr_applied,
                    metadata_json=page_meta,
                )
                db.add(page_model)
                created_pages.append(page_model)

            await db.flush()  # Flush so page primary keys (page_model.id) are resolved

            # 7. Intelligent Document Chunking
            job.progress_percentage = 70
            await db.commit()

            chunks = self.chunking_service.chunk_document_pages(
                pages=created_pages,
                workspace_id=document.workspace_id,
                document_id=document.id,
            )

            # 8. Vector Embedding Generation & Vector Persistence
            job.progress_percentage = 85
            await db.commit()

            if chunks:
                embeddings = await self.embedding_service.embed_chunks(chunks)
                for chunk_item, vec in zip(chunks, embeddings):
                    chunk_meta = {
                        **chunk_item.metadata_json,
                        "section_title": chunk_item.section_title,
                        "chunk_type": chunk_item.chunk_type,
                        "page_number": chunk_item.page_number,
                        "model_name": self.embedding_service.provider.model_name,
                        "embedding_dim": len(vec),
                    }
                    chunk_record = DocumentChunk(
                        id=chunk_item.id,
                        workspace_id=chunk_item.workspace_id,
                        document_id=chunk_item.document_id,
                        page_id=chunk_item.page_id,
                        chunk_index=chunk_item.chunk_index,
                        content=chunk_item.content,
                        token_count=chunk_item.token_count,
                        embedding=vec,
                        metadata_json=chunk_meta,
                    )
                    db.add(chunk_record)

            # 9. Update document master record
            document.page_count = result.total_pages
            document.status = "READY"
            document.processing_error = None
            updated_doc_meta = dict(document.metadata_json)
            updated_doc_meta.update({
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "extraction_warnings": result.warnings,
                "chunk_count": len(chunks),
                "embedding_model": self.embedding_service.provider.model_name,
                **result.document_metadata,
            })
            document.metadata_json = updated_doc_meta

            # 10. Mark job completed
            job.status = "COMPLETED"
            job.progress_percentage = 100
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = None

            # 11. Audit event
            audit = AuditLog(
                workspace_id=document.workspace_id,
                user_id=document.user_id,
                action="DOCUMENT_PROCESSED",
                resource_type="document",
                resource_id=document.id,
                details={
                    "total_pages": result.total_pages,
                    "total_chunks": len(chunks),
                    "status": "READY",
                    "warnings_count": len(result.warnings),
                },
            )
            db.add(audit)

            await db.commit()
            logger.info(
                "Document %s processed successfully: %d pages, %d chunks.",
                document.id, result.total_pages, len(chunks),
            )
            return True

        except Exception as e:
            logger.error("Processing error for job %s: %s", job_id, e)
            logger.debug(traceback.format_exc())

            job.retry_count += 1
            error_msg = f"Processing error: {str(e)}"
            job.error_message = error_msg
            document.processing_error = error_msg

            if job.retry_count >= self.max_retries:
                job.status = "FAILED"
                job.completed_at = datetime.now(timezone.utc)
                document.status = "FAILED"
                logger.warning("Job %s exceeded max retries (%d). Marked FAILED.", job.id, self.max_retries)
            else:
                job.status = "QUEUED"
                document.status = "FAILED"

            audit = AuditLog(
                workspace_id=document.workspace_id,
                user_id=document.user_id,
                action="DOCUMENT_PROCESSING_FAILED",
                resource_type="document",
                resource_id=document.id,
                details={
                    "job_id": str(job.id),
                    "retry_count": job.retry_count,
                    "error": error_msg[:500],
                },
            )
            db.add(audit)

            await db.commit()
            return False
