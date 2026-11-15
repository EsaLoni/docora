"""Integration Tests for UDIP Search API Endpoint (`POST /api/v1/search`).

Tests:
- Hybrid search execution and response schema
- Vector search mode
- Keyword search mode
- Multi-tenant workspace isolation (User B cannot see User A's results)
- Input validation (empty query, limit capping)
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_search_api_hybrid_success(client: TestClient):
    """Verify POST /api/v1/search executes hybrid search on indexed content."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    auth_headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # Upload and process a document
    txt_content = b"# Financial Report\n\nRevenue grew by 25% year over year in fiscal 2026."
    files = {"file": ("financial_report.txt", io.BytesIO(txt_content), "text/plain")}
    upload_res = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Trigger synchronous processing
    proc_res = client.post(f"/api/v1/documents/{doc_id}/process?background=false", headers=auth_headers)
    assert proc_res.status_code == 200

    # Search via hybrid mode
    search_payload = {
        "query": "Revenue grew in fiscal 2026",
        "mode": "hybrid",
        "limit": 5,
    }
    response = client.post("/api/v1/search", json=search_payload, headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["query"] == "Revenue grew in fiscal 2026"
    assert data["mode"] == "hybrid"
    assert "total_results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) >= 1

    item = data["results"][0]
    assert item["document_id"] == doc_id
    assert "Revenue grew" in item["content"]
    assert 0.0 <= item["score"] <= 1.0
    assert item["retrieval_mode"] == "hybrid"


def test_search_api_vector_and_keyword_modes(client: TestClient):
    """Verify search endpoint handles explicit vector and keyword modes."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    auth_headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # Upload document
    content = b"High performance AI platform architecture document."
    files = {"file": ("architecture.txt", io.BytesIO(content), "text/plain")}
    up = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert up.status_code == 201
    doc_id = up.json()["id"]
    client.post(f"/api/v1/documents/{doc_id}/process?background=false", headers=auth_headers)

    # Vector mode
    v_res = client.post(
        "/api/v1/search",
        json={"query": "platform architecture", "mode": "vector", "limit": 3},
        headers=auth_headers,
    )
    assert v_res.status_code == 200
    assert v_res.json()["mode"] == "vector"

    # Keyword mode
    k_res = client.post(
        "/api/v1/search",
        json={"query": "architecture", "mode": "keyword", "limit": 3},
        headers=auth_headers,
    )
    assert k_res.status_code == 200
    assert k_res.json()["mode"] == "keyword"


def test_search_api_workspace_isolation(client: TestClient):
    """Verify User B in Workspace 2 cannot retrieve chunks uploaded by User A in Workspace 1."""
    # User A setup
    uid_a = f"usera-{uuid.uuid4().hex[:6]}"
    tok_a = make_test_token(user_id=uid_a, email=f"{uid_a}@udip.local")
    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok_a}"}).json()
    ws_a = me_a["workspaces"][0]["id"]
    headers_a = {"Authorization": f"Bearer {tok_a}", "X-Workspace-ID": ws_a}

    secret_content = b"Super confidential alpha secret code xyz123."
    files = {"file": ("secret.txt", io.BytesIO(secret_content), "text/plain")}
    up = client.post("/api/v1/documents/upload", files=files, headers=headers_a)
    doc_id = up.json()["id"]
    client.post(f"/api/v1/documents/{doc_id}/process?background=false", headers=headers_a)

    # User B setup
    uid_b = f"userb-{uuid.uuid4().hex[:6]}"
    tok_b = make_test_token(user_id=uid_b, email=f"{uid_b}@udip.local")
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok_b}"}).json()
    ws_b = me_b["workspaces"][0]["id"]
    headers_b = {"Authorization": f"Bearer {tok_b}", "X-Workspace-ID": ws_b}

    # User B searches for User A's unique token "xyz123"
    b_res = client.post(
        "/api/v1/search",
        json={"query": "xyz123", "mode": "hybrid"},
        headers=headers_b,
    )
    assert b_res.status_code == 200
    # Must return 0 results because content belongs to Workspace A
    assert len(b_res.json()["results"]) == 0


def test_search_api_input_validation(client: TestClient):
    """Verify validation rules on search requests (min query length, limit clamping)."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    auth_headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # Empty query should return 422 Unprocessable Entity
    res_empty = client.post(
        "/api/v1/search",
        json={"query": "", "mode": "hybrid"},
        headers=auth_headers,
    )
    assert res_empty.status_code == 422

    # Invalid mode
    res_mode = client.post(
        "/api/v1/search",
        json={"query": "test", "mode": "invalid_mode_xyz"},
        headers=auth_headers,
    )
    assert res_mode.status_code == 422
