"""Integration Tests for Intelligence REST API Endpoints.

Tests:
- POST /api/v1/intelligence/summarize (sync and async)
- GET /api/v1/intelligence/documents/{id}/summary
- POST /api/v1/intelligence/compare
- POST /api/v1/intelligence/extract
- GET /api/v1/intelligence/documents/{id}/extractions
- POST /api/v1/intelligence/insights
- GET /api/v1/intelligence/documents/{id}/insights
- GET /api/v1/intelligence/jobs/{id}
- POST /api/v1/intelligence/jobs/{id}/cancel
- POST /api/v1/intelligence/export (Markdown, JSON, CSV, PDF)
- POST /api/v1/intelligence/tables/analyze
- Multi-tenant cross-workspace isolation enforcement
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_intelligence_summarize_and_insights_api(client: TestClient):
    """Verify summarize and insights endpoints work synchronously and return proper models."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Upload and synchronously process a document
    content = b"Quarterly fiscal review shows $12.4M in recurring revenue and 15% EBITDA growth."
    files = {"file": ("fiscal.txt", io.BytesIO(content), "text/plain")}
    upload_res = client.post("/api/v1/documents/upload", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]
    client.post(f"/api/v1/documents/{doc_id}/process?background=false", headers=headers)

    # 2. Synchronous summary
    sum_res = client.post(
        "/api/v1/intelligence/summarize",
        json={"document_id": doc_id, "summary_type": "quick"},
        headers=headers,
    )
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert sum_data["document_id"] == doc_id
    assert sum_data["summary_type"] == "quick"
    assert "summary_text" in sum_data

    # 3. Retrieve latest summary
    get_sum_res = client.get(f"/api/v1/intelligence/documents/{doc_id}/summary", headers=headers)
    assert get_sum_res.status_code == 200
    assert get_sum_res.json()["id"] == sum_data["id"]

    # 4. Asynchronous job enqueue
    async_res = client.post(
        "/api/v1/intelligence/summarize?async_job=true",
        json={"document_id": doc_id, "summary_type": "quick"},
        headers=headers,
    )
    assert async_res.status_code == 200
    job_info = async_res.json()
    assert "job_id" in job_info
    assert job_info["status"] == "QUEUED"

    # 5. Query job status
    job_res = client.get(f"/api/v1/intelligence/jobs/{job_info['job_id']}", headers=headers)
    assert job_res.status_code == 200
    assert job_res.json()["status"] in ["QUEUED", "PROCESSING", "COMPLETED"]

    # 6. Cancel job
    cancel_res = client.post(f"/api/v1/intelligence/jobs/{job_info['job_id']}/cancel", headers=headers)
    assert cancel_res.status_code == 200

    # 7. Generate insights
    ins_res = client.post(
        "/api/v1/intelligence/insights",
        json={"document_id": doc_id},
        headers=headers,
    )
    assert ins_res.status_code == 200
    ins_data = ins_res.json()
    assert ins_data["document_id"] == doc_id
    assert ins_data["total_insights"] > 0

    # 8. Retrieve insights
    get_ins_res = client.get(f"/api/v1/intelligence/documents/{doc_id}/insights", headers=headers)
    assert get_ins_res.status_code == 200
    assert get_ins_res.json()["total_insights"] == ins_data["total_insights"]


def test_intelligence_comparison_and_extraction_api(client: TestClient):
    """Verify comparison and structured extraction endpoints."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # Upload and process Doc A and Doc B
    files_a = {"file": ("contract_a.txt", io.BytesIO(b"Vendor: Acme Corp. Liability limit is $1,000,000."), "text/plain")}
    files_b = {"file": ("contract_b.txt", io.BytesIO(b"Vendor: Acme Corp. Liability limit is $2,500,000."), "text/plain")}

    doc_a_id = client.post("/api/v1/documents/upload", files=files_a, headers=headers).json()["id"]
    doc_b_id = client.post("/api/v1/documents/upload", files=files_b, headers=headers).json()["id"]

    client.post(f"/api/v1/documents/{doc_a_id}/process?background=false", headers=headers)
    client.post(f"/api/v1/documents/{doc_b_id}/process?background=false", headers=headers)

    # 1. Compare Doc A and Doc B
    comp_res = client.post(
        "/api/v1/intelligence/compare",
        json={"document_ids": [doc_a_id, doc_b_id], "comparison_type": "comprehensive"},
        headers=headers,
    )
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert len(comp_data["document_ids"]) == 2
    assert len(comp_data["differences"]) > 0

    # 2. Extract structured fields from Doc A
    ext_res = client.post(
        "/api/v1/intelligence/extract",
        json={
            "document_id": doc_a_id,
            "template": "contract",
            "custom_fields": ["vendor", "liability_limit", "unspecified_field"],
        },
        headers=headers,
    )
    assert ext_res.status_code == 200
    ext_data = ext_res.json()
    assert ext_data["document_id"] == doc_a_id
    assert len(ext_data["fields"]) > 0

    # 3. List historical extractions for document
    hist_res = client.get(f"/api/v1/intelligence/documents/{doc_a_id}/extractions", headers=headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1


def test_table_analyze_and_export_api(client: TestClient):
    """Verify table analysis and export endpoints (Markdown, JSON, CSV, PDF)."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Table Analysis API
    table_md = "| Metric | 2023 | 2024 |\n|---|---|---|\n| Revenue | $10M | $14M |\n| Net Income | $2M | $3.5M |"
    tbl_res = client.post(
        "/api/v1/intelligence/tables/analyze",
        json={"markdown_table": table_md, "page_number": 1},
        headers=headers,
    )
    assert tbl_res.status_code == 200
    tbl_data = tbl_res.json()
    assert len(tbl_data) == 1
    assert tbl_data[0]["row_count"] == 2
    assert tbl_data[0]["col_count"] == 3

    # 2. Export Markdown
    exp_md = client.post(
        "/api/v1/intelligence/export",
        json={
            "export_type": "summary",
            "format": "markdown",
            "payload": {"title": "Test Report", "content": "Summary text content here."},
        },
        headers=headers,
    )
    assert exp_md.status_code == 200
    assert "text/markdown" in exp_md.headers["content-type"]
    assert b"# Test Report" in exp_md.content

    # 3. Export JSON
    exp_json = client.post(
        "/api/v1/intelligence/export",
        json={
            "export_type": "extraction",
            "format": "json",
            "payload": {"fields": [{"field_name": "vendor", "value": "Acme"}]},
        },
        headers=headers,
    )
    assert exp_json.status_code == 200
    assert "application/json" in exp_json.headers["content-type"]

    # 4. Export CSV
    exp_csv = client.post(
        "/api/v1/intelligence/export",
        json={
            "export_type": "comparison",
            "format": "csv",
            "payload": {
                "differences": [
                    {
                        "category": "Financial",
                        "doc_a_value": "$100",
                        "doc_b_value": "$200",
                        "explanation": "Cost increased",
                        "status": "conflicting",
                        "confidence": 0.95,
                    }
                ]
            },
        },
        headers=headers,
    )
    assert exp_csv.status_code == 200
    assert "text/csv" in exp_csv.headers["content-type"]
    assert b"Financial,$100,$200" in exp_csv.content

    # 5. Export PDF (via PyMuPDF)
    exp_pdf = client.post(
        "/api/v1/intelligence/export",
        json={
            "export_type": "summary",
            "format": "pdf",
            "payload": {
                "title": "Quarterly Performance",
                "content": "Overall performance exceeded baseline expectations.",
            },
        },
        headers=headers,
    )
    assert exp_pdf.status_code == 200
    assert "application/pdf" in exp_pdf.headers["content-type"]
    assert exp_pdf.content.startswith(b"%PDF")  # Valid PDF header magic bytes


def test_intelligence_workspace_isolation_api(client: TestClient):
    """Verify User B cannot access or mutate User A's intelligence records."""
    # Tenant A
    user_a = f"usera-{uuid.uuid4().hex[:6]}"
    token_a = make_test_token(user_id=user_a, email=f"{user_a}@udip.local")
    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    ws_a_id = me_a["workspaces"][0]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_a_id}

    # Tenant B
    user_b = f"userb-{uuid.uuid4().hex[:6]}"
    token_b = make_test_token(user_id=user_b, email=f"{user_b}@udip.local")
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()
    ws_b_id = me_b["workspaces"][0]["id"]
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Workspace-ID": ws_b_id}

    # Upload and process Doc in Tenant A
    files = {"file": ("private_a.txt", io.BytesIO(b"Confidential workspace A data"), "text/plain")}
    doc_a_id = client.post("/api/v1/documents/upload", files=files, headers=headers_a).json()["id"]
    client.post(f"/api/v1/documents/{doc_a_id}/process?background=false", headers=headers_a)

    # User B attempts to summarize User A's document
    res = client.post(
        "/api/v1/intelligence/summarize",
        json={"document_id": doc_a_id, "summary_type": "quick"},
        headers=headers_b,  # Tenant B headers
    )
    assert res.status_code == 404
