"""Security Tests for Cross-Tenant Document Upload, Download, and Deletion Rejection."""

import io
import uuid
import pytest
from fastapi.testclient import TestClient
from tests.conftest import make_test_token


def test_unauthenticated_document_endpoints_rejected(client: TestClient):
    """Verify upload, list, download, and delete reject unauthenticated requests."""
    fake_id = uuid.uuid4()
    assert client.post("/api/v1/documents/upload").status_code == 401
    assert client.get("/api/v1/documents").status_code == 401
    assert client.get(f"/api/v1/documents/{fake_id}").status_code == 401
    assert client.get(f"/api/v1/documents/{fake_id}/download").status_code == 401
    assert client.delete(f"/api/v1/documents/{fake_id}").status_code == 401


def test_cross_tenant_document_upload_rejected(client: TestClient):
    """Verify User A cannot upload files into User B's workspace."""
    token_a = make_test_token(user_id=f"ua-{uuid.uuid4().hex[:6]}", email="ua@corp.local")
    token_b = make_test_token(user_id=f"ub-{uuid.uuid4().hex[:6]}", email="ub@corp.local")

    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()
    ws_b_id = me_b["workspaces"][0]["id"]

    # User A tries uploading to User B's workspace
    files = {"file": ("breach.pdf", io.BytesIO(b"%PDF-1.4\nBreach\n%%EOF"), "application/pdf")}
    res = client.post(
        "/api/v1/documents/upload",
        files=files,
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_b_id},
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "WORKSPACE_ACCESS_DENIED"


def test_cross_tenant_document_deletion_rejected(client: TestClient):
    """Verify User A cannot delete User B's documents."""
    token_a = make_test_token(user_id=f"ua-{uuid.uuid4().hex[:6]}", email="ua@corp.local")
    token_b = make_test_token(user_id=f"ub-{uuid.uuid4().hex[:6]}", email="ub@corp.local")

    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()

    ws_a_id = me_a["workspaces"][0]["id"]
    ws_b_id = me_b["workspaces"][0]["id"]

    # User B uploads a document
    doc_b = client.post(
        "/api/v1/documents/upload",
        files={"file": ("b_secret.pdf", io.BytesIO(b"%PDF-1.4\nSecret B\n%%EOF"), "application/pdf")},
        headers={"Authorization": f"Bearer {token_b}", "X-Workspace-ID": ws_b_id},
    ).json()
    doc_b_id = doc_b["id"]

    # Attack 1: User A targets Workspace B directly -> 403
    del_res1 = client.delete(
        f"/api/v1/documents/{doc_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_b_id},
    )
    assert del_res1.status_code == 403

    # Attack 2: User A targets own Workspace A with User B's doc_id -> 404
    del_res2 = client.delete(
        f"/api/v1/documents/{doc_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_a_id},
    )
    assert del_res2.status_code == 404

    # Verify User B's document still exists
    get_res = client.get(
        f"/api/v1/documents/{doc_b_id}",
        headers={"Authorization": f"Bearer {token_b}", "X-Workspace-ID": ws_b_id},
    )
    assert get_res.status_code == 200


def test_cross_tenant_process_pending_rejected_and_isolated(client: TestClient):
    """Verify process-pending requires auth, rejects unauthorized workspace headers, and is tenant-scoped."""
    token_a = make_test_token(user_id=f"ua-{uuid.uuid4().hex[:6]}", email="ua@corp.local")
    token_b = make_test_token(user_id=f"ub-{uuid.uuid4().hex[:6]}", email="ub@corp.local")

    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()

    ws_a_id = me_a["workspaces"][0]["id"]
    ws_b_id = me_b["workspaces"][0]["id"]

    # 1. Unauthenticated request rejected
    unauth_res = client.post("/api/v1/documents/process-pending")
    assert unauth_res.status_code == 401

    # 2. User A attempts to trigger processing in Workspace B -> 403 Forbidden
    cross_res = client.post(
        "/api/v1/documents/process-pending",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_b_id},
    )
    assert cross_res.status_code == 403
    assert cross_res.json()["error"]["code"] == "WORKSPACE_ACCESS_DENIED"

    # 3. User A triggers processing in own Workspace A -> 200 OK scoped strictly to Workspace A
    auth_res = client.post(
        "/api/v1/documents/process-pending",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_a_id},
    )
    assert auth_res.status_code == 200
    data = auth_res.json()
    assert data["status"] == "success"
    assert data["workspace_id"] == ws_a_id
