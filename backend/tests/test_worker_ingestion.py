"""Tests for Ingestion Worker and Document Processor.

Verifies status state transitions, progress tracking, idempotent page writes,
and retry/failure handling.
"""

import asyncio
from unittest.mock import patch
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Workspace
from app.services.storage.local import LocalStorageAdapter
from app.services.worker.processor import DocumentProcessor


async def _create_test_document_and_job(session: AsyncSession, settings: Settings):
    """Helper to set up a valid workspace, document, and queued job."""
    user = User(
        id=uuid.uuid4(),
        email="worker_test@udip.local",
        full_name="Worker Tester",
        is_active=True,
    )
    session.add(user)

    ws = Workspace(
        id=uuid.uuid4(),
        name="Worker Test Workspace",
        slug=f"worker-test-{uuid.uuid4().hex[:8]}",
        owner_id=user.id,
        settings={},
    )
    session.add(ws)

    adapter = LocalStorageAdapter(settings)
    doc_id = uuid.uuid4()
    content = b"Universal Document Intelligence Platform\n\nPage 1 Content\n\nThis is verified."

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
        title="Sample Document",
        filename="sample.txt",
        file_path=file_path,
        file_size_bytes=len(content),
        mime_type="text/plain",
        file_hash="test_sha256_hash_worker",
        page_count=0,
        status="UPLOADED",
        metadata_json={},
    )
    session.add(doc)

    job = ProcessingJob(
        workspace_id=ws.id,
        document_id=doc.id,
        job_type="FULL_INGESTION",
        status="QUEUED",
        progress_percentage=0,
    )
    session.add(job)
    await session.commit()
    await session.refresh(doc)
    await session.refresh(job)

    return doc, job, adapter


def test_processor_success_pipeline(session_factory: async_sessionmaker[AsyncSession], test_settings: Settings):
    """Verify end-to-end processing pipeline, status transitions, and page insertion."""
    async def _test():
        async with session_factory() as session:
            doc, job, adapter = await _create_test_document_and_job(session, test_settings)
            processor = DocumentProcessor(test_settings)

            success = await processor.process_job(job.id, session, adapter)
            assert success is True

            await session.refresh(doc)
            await session.refresh(job)

            assert job.status == "COMPLETED"
            assert job.progress_percentage == 100
            assert job.completed_at is not None
            assert doc.status == "READY"
            assert doc.page_count >= 1

            pages_stmt = select(DocumentPage).where(DocumentPage.document_id == doc.id)
            pages = (await session.execute(pages_stmt)).scalars().all()
            assert len(pages) == doc.page_count
            assert pages[0].page_number == 1
            assert "Universal Document Intelligence" in pages[0].content

            # Verify DocumentChunk vector persistence
            chunks_stmt = select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
            chunks = (await session.execute(chunks_stmt)).scalars().all()
            assert len(chunks) >= 1
            assert len(chunks[0].embedding) == 384
            assert doc.metadata_json.get("chunk_count") == len(chunks)
            assert doc.metadata_json.get("embedding_model") is not None

    asyncio.run(_test())


def test_processor_idempotent_reprocessing(session_factory: async_sessionmaker[AsyncSession], test_settings: Settings):
    """Verify that re-processing an existing document deletes old pages and avoids duplicates."""
    async def _test():
        async with session_factory() as session:
            doc, job, adapter = await _create_test_document_and_job(session, test_settings)
            processor = DocumentProcessor(test_settings)

            # First pass
            await processor.process_job(job.id, session, adapter)

            p_stmt = select(DocumentPage).where(DocumentPage.document_id == doc.id)
            initial_count = len((await session.execute(p_stmt)).scalars().all())

            # Second job
            job2 = ProcessingJob(
                workspace_id=doc.workspace_id,
                document_id=doc.id,
                job_type="FULL_INGESTION",
                status="QUEUED",
                progress_percentage=0,
            )
            session.add(job2)
            await session.commit()
            await session.refresh(job2)

            # Second pass
            await processor.process_job(job2.id, session, adapter)

            pages_after = (await session.execute(p_stmt)).scalars().all()
            assert len(pages_after) == initial_count

    asyncio.run(_test())


def test_processor_error_and_retries(session_factory: async_sessionmaker[AsyncSession], test_settings: Settings):
    """Verify retry counter increment and failure status after max retries."""
    async def _test():
        async with session_factory() as session:
            doc, job, adapter = await _create_test_document_and_job(session, test_settings)
            processor = DocumentProcessor(test_settings)

            with patch.object(adapter, "read_file", side_effect=IOError("Storage disk failure")):
                success = await processor.process_job(job.id, session, adapter)
                assert success is False

                await session.refresh(job)
                await session.refresh(doc)

                assert job.retry_count == 1
                assert "Storage disk failure" in job.error_message
                assert job.status == "QUEUED"
                assert doc.status == "FAILED"

                # Simulate reaching MAX_RETRIES (3)
                job.retry_count = 2
                await session.commit()

                success2 = await processor.process_job(job.id, session, adapter)
                assert success2 is False

                await session.refresh(job)
                assert job.retry_count == 3
                assert job.status == "FAILED"
                assert doc.status == "FAILED"

    asyncio.run(_test())
