"""Integration Tests for Document Upload, Download, Management, and Deletion APIs."""

import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.document import Document
from tests.conftest import make_test_token


def test_document_upload_success_and_metadata(client: TestClient):
    """Verify uploading a valid PDF document into a workspace."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")

    # Resolve workspace
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    # Upload PDF
    pdf_content = b"%PDF-1.5\nSample Document Content for Testing\n%%EOF"
    files = {"file": ("sample_report.pdf", io.BytesIO(pdf_content), "application/pdf")}

    response = client.post(
        "/api/v1/documents/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "sample_report"
    assert data["filename"] == "sample_report.pdf"
    assert data["status"] == "UPLOADED"
    assert data["file_size_bytes"] == len(pdf_content)
    assert data["workspace_id"] == ws_id


def test_duplicate_document_upload_rejected(client: TestClient):
    """Verify duplicate upload within same workspace is rejected with 409 Conflict."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    content = b"%PDF-1.4\nUnique body for duplicate test\n%%EOF"
    files1 = {"file": ("original.pdf", io.BytesIO(content), "application/pdf")}
    res1 = client.post(
        "/api/v1/documents/upload",
        files=files1,
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res1.status_code == 201

    # Attempt second upload with identical content
    files2 = {"file": ("duplicate_copy.pdf", io.BytesIO(content), "application/pdf")}
    res2 = client.post(
        "/api/v1/documents/upload",
        files=files2,
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "DUPLICATE_DOCUMENT"


def test_workspace_quota_enforcement(app, client: TestClient):
    """Verify uploads exceeding workspace quota are rejected with 413."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    # Configure small quota
    from app.core.config import Settings, get_settings
    small_quota_settings = Settings(
        DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES=500,  # 500 bytes quota
    )
    app.dependency_overrides[get_settings] = lambda: small_quota_settings

    large_pdf = b"%PDF-1.4\n" + b"A" * 600 + b"\n%%EOF"
    files = {"file": ("large.pdf", io.BytesIO(large_pdf), "application/pdf")}
    res = client.post(
        "/api/v1/documents/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    app.dependency_overrides.pop(get_settings, None)

    assert res.status_code == 413
    assert res.json()["error"]["code"] == "STORAGE_QUOTA_EXCEEDED"


def test_list_and_search_documents(client: TestClient):
    """Verify listing documents with search and pagination."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    # Upload 2 docs
    d1_content = b"%PDF-1.4\nAlpha Document Body\n%%EOF"
    d2_content = b"%PDF-1.4\nBeta Document Body\n%%EOF"

    client.post(
        "/api/v1/documents/upload",
        files={"file": ("alpha_report.pdf", io.BytesIO(d1_content), "application/pdf")},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    client.post(
        "/api/v1/documents/upload",
        files={"file": ("beta_summary.pdf", io.BytesIO(d2_content), "application/pdf")},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )

    # 1. List all
    res_all = client.get(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res_all.status_code == 200
    assert res_all.json()["total_count"] >= 2

    # 2. Search for 'Alpha'
    res_search = client.get(
        "/api/v1/documents?search=alpha",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res_search.status_code == 200
    items = res_search.json()["items"]
    assert len(items) == 1
    assert items[0]["filename"] == "alpha_report.pdf"


def test_download_signed_url_and_stream(client: TestClient):
    """Verify document signed download URL generation and authenticated streaming."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    pdf_content = b"%PDF-1.4\nDownload Stream Test Content\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("download_test.pdf", io.BytesIO(pdf_content), "application/pdf")},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    doc_id = upload_res.json()["id"]

    # 1. Request signed URL
    dl_res = client.get(
        f"/api/v1/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert dl_res.status_code == 200
    signed_url = dl_res.json()["download_url"]

    # 2. Fetch file via signed URL
    stream_res = client.get(signed_url)
    assert stream_res.status_code == 200
    assert stream_res.content == pdf_content
    assert "attachment" in stream_res.headers["content-disposition"]


def test_move_document_between_folders(client: TestClient):
    """Verify moving document into and out of folders."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    # Create folder
    f_res = client.post(
        "/api/v1/folders",
        json={"name": "Archive Folder"},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    folder_id = f_res.json()["id"]

    # Upload doc to root
    doc_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("move_me.pdf", io.BytesIO(b"%PDF-1.4\nMove Me\n%%EOF"), "application/pdf")},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    doc_id = doc_res.json()["id"]
    assert doc_res.json()["folder_id"] is None

    # Move doc into folder
    move_res = client.patch(
        f"/api/v1/documents/{doc_id}/move",
        json={"folder_id": folder_id},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert move_res.status_code == 200
    assert move_res.json()["folder_id"] == folder_id

    # Move back to root (folder_id=None)
    move_back = client.patch(
        f"/api/v1/documents/{doc_id}/move",
        json={"folder_id": None},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert move_back.status_code == 200
    assert move_back.json()["folder_id"] is None


def test_delete_document_purges_db_and_storage(client: TestClient, session_factory: async_sessionmaker[AsyncSession]):
    """Verify deleting document physically removes storage file and database record."""
    import asyncio
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    pdf_content = b"%PDF-1.4\nDelete Me Content\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("delete_test.pdf", io.BytesIO(pdf_content), "application/pdf")},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    doc_id = upload_res.json()["id"]

    # Delete document
    del_res = client.delete(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert del_res.status_code == 204

    # Subsequent GET returns 404
    get_res = client.get(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert get_res.status_code == 404

    # Verify database record deleted
    async def verify_db():
        async with session_factory() as s:
            stmt = select(Document).where(Document.id == uuid.UUID(doc_id))
            res = (await s.execute(stmt)).scalar_one_or_none()
            assert res is None

    asyncio.run(verify_db())
