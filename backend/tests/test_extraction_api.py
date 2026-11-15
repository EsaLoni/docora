"""Tests for Document Processing and Page Inspection APIs.

Verifies processing status endpoint, manual reprocessing triggers,
paginated page listing, page detail endpoint, and strict multi-tenant isolation.
"""

import asyncio
import io
import uuid
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.models.document import Document, DocumentPage
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.services.storage.local import LocalStorageAdapter
from tests.conftest import make_test_token


def _setup_processed_document(session_factory: async_sessionmaker[AsyncSession], settings: Settings):
    """Create test user, workspace, document with 2 pages, and a completed job."""
    async def _setup():
        async with session_factory() as session:
            uid = f"user-{uuid.uuid4().hex[:6]}"
            user = User(
                id=uuid.uuid4(),
                email=f"{uid}@udip.local",
                full_name="Extraction Tester",
                is_active=True,
            )
            session.add(user)

            ws = Workspace(
                id=uuid.uuid4(),
                name="Extraction Test Workspace",
                slug=f"extraction-test-{uuid.uuid4().hex[:8]}",
                owner_id=user.id,
                settings={},
            )
            session.add(ws)

            member = WorkspaceMember(
                workspace_id=ws.id,
                user_id=user.id,
                role="OWNER",
            )
            session.add(member)

            adapter = LocalStorageAdapter(settings)
            doc_id = uuid.uuid4()
            content = b"Page 1 Content\n\nSome introductory remarks."

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
                title="Verified Contract",
                filename="contract.txt",
                file_path=file_path,
                file_size_bytes=len(content),
                mime_type="text/plain",
                file_hash="hash_contract_123",
                page_count=2,
                status="READY",
                metadata_json={"author": "Legal Team"},
            )
            session.add(doc)

            p1 = DocumentPage(
                document_id=doc.id,
                page_number=1,
                content="Page 1 Content\n\nSome introductory remarks.",
                token_count=12,
                has_images=False,
                ocr_applied=False,
                metadata_json={"tables": []},
            )
            p2 = DocumentPage(
                document_id=doc.id,
                page_number=2,
                content="Page 2 Content\n\nTerms and Conditions.",
                token_count=10,
                has_images=True,
                ocr_applied=True,
                metadata_json={
                    "ocr_confidence": 96.5,
                    "tables": [
                        {
                            "headers": ["Term", "Value"],
                            "rows": [["Duration", "12 Months"]],
                            "markdown": "| Term | Value |\n|---|---|\n| Duration | 12 Months |",
                        }
                    ],
                },
            )
            session.add(p1)
            session.add(p2)

            job = ProcessingJob(
                workspace_id=ws.id,
                document_id=doc.id,
                job_type="FULL_INGESTION",
                status="COMPLETED",
                progress_percentage=100,
            )
            session.add(job)

            await session.commit()
            return user, ws, doc, job

    return asyncio.run(_setup())


def test_get_processing_status_success(
    client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    test_settings: Settings,
):
    """Verify retrieval of processing job status and progress."""
    user, ws, doc, job = _setup_processed_document(session_factory, test_settings)
    token = make_test_token(user_id=str(user.id), email=user.email)
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": str(ws.id)}

    res = client.get(f"/api/v1/documents/{doc.id}/processing", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["document_id"] == str(doc.id)
    assert data["status"] == "COMPLETED"
    assert data["progress_percentage"] == 100


def test_trigger_document_processing_sync(
    client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    test_settings: Settings,
):
    """Verify synchronous processing trigger re-executes ingestion."""
    user, ws, doc, job = _setup_processed_document(session_factory, test_settings)
    token = make_test_token(user_id=str(user.id), email=user.email)
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": str(ws.id)}

    res = client.post(
        f"/api/v1/documents/{doc.id}/process?background=false",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["document_id"] == str(doc.id)
    assert data["status"] == "COMPLETED"
    assert data["progress_percentage"] == 100


def test_list_document_pages(
    client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    test_settings: Settings,
):
    """Verify paginated page list returns summaries and OCR indicators."""
    user, ws, doc, job = _setup_processed_document(session_factory, test_settings)
    token = make_test_token(user_id=str(user.id), email=user.email)
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": str(ws.id)}

    res = client.get(f"/api/v1/documents/{doc.id}/pages?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_pages"] == 2
    assert len(data["items"]) == 2

    # Page 1 (native)
    assert data["items"][0]["page_number"] == 1
    assert data["items"][0]["ocr_applied"] is False

    # Page 2 (OCR with table)
    assert data["items"][1]["page_number"] == 2
    assert data["items"][1]["ocr_applied"] is True
    assert data["items"][1]["ocr_confidence"] == 96.5
    assert data["items"][1]["tables_count"] == 1


def test_get_document_page_detail(
    client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    test_settings: Settings,
):
    """Verify detailed page retrieval including formatted tables."""
    user, ws, doc, job = _setup_processed_document(session_factory, test_settings)
    token = make_test_token(user_id=str(user.id), email=user.email)
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": str(ws.id)}

    res = client.get(f"/api/v1/documents/{doc.id}/pages/2", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["page_number"] == 2
    assert "Terms and Conditions" in data["content"]
    assert len(data["tables"]) == 1
    assert data["tables"][0]["headers"] == ["Term", "Value"]

    # Non-existent page returns 404
    res_404 = client.get(f"/api/v1/documents/{doc.id}/pages/999", headers=headers)
    assert res_404.status_code == 404


def test_extraction_api_tenant_isolation(
    client: TestClient,
    session_factory: async_sessionmaker[AsyncSession],
    test_settings: Settings,
):
    """Verify cross-tenant requests to extraction and page endpoints are rejected."""
    user, ws, doc, job = _setup_processed_document(session_factory, test_settings)

    # Create separate Tenant B
    async def _setup_tenant_b():
        async with session_factory() as session:
            b_user = User(
                id=uuid.uuid4(),
                email="tenant_b@udip.local",
                full_name="Tenant B",
                is_active=True,
            )
            session.add(b_user)
            ws_b = Workspace(
                id=uuid.uuid4(),
                name="Workspace B",
                slug=f"ws-b-{uuid.uuid4().hex[:8]}",
                owner_id=b_user.id,
                settings={},
            )
            session.add(ws_b)
            member_b = WorkspaceMember(
                workspace_id=ws_b.id,
                user_id=b_user.id,
                role="OWNER",
            )
            session.add(member_b)
            await session.commit()
            return b_user, ws_b

    b_user, ws_b = asyncio.run(_setup_tenant_b())
    token_b = make_test_token(user_id=str(b_user.id), email=b_user.email)
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Workspace-ID": str(ws_b.id)}

    # Tenant B attempts to access Tenant A's document endpoints
    res_proc = client.get(f"/api/v1/documents/{doc.id}/processing", headers=headers_b)
    assert res_proc.status_code in (403, 404)

    res_post = client.post(f"/api/v1/documents/{doc.id}/process", headers=headers_b)
    assert res_post.status_code in (403, 404)

    res_pages = client.get(f"/api/v1/documents/{doc.id}/pages", headers=headers_b)
    assert res_pages.status_code in (403, 404)

    res_page_det = client.get(f"/api/v1/documents/{doc.id}/pages/1", headers=headers_b)
    assert res_page_det.status_code in (403, 404)
