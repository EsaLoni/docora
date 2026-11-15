"""Integration Tests for UDIP Chat and Conversation REST APIs.

Tests:
- POST /api/v1/chat/conversations (Create)
- GET /api/v1/chat/conversations (List)
- GET /api/v1/chat/conversations/{id} (Detail with messages)
- PATCH /api/v1/chat/conversations/{id} (Update title)
- DELETE /api/v1/chat/conversations/{id} (Delete)
- POST /api/v1/chat/conversations/{id}/messages (Grounded Q&A)
- POST /api/v1/chat/conversations/{id}/messages with stream=True (SSE streaming)
- Multi-tenant isolation enforcement
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_conversation_crud_api(client: TestClient):
    """Verify conversation lifecycle via API endpoints."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Create conversation
    create_res = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Executive Summary Chat", "active_document_ids": []},
        headers=headers,
    )
    assert create_res.status_code == 201
    conv = create_res.json()
    conv_id = conv["id"]
    assert conv["title"] == "Executive Summary Chat"
    assert conv["workspace_id"] == ws_id

    # 2. List conversations
    list_res = client.get("/api/v1/chat/conversations", headers=headers)
    assert list_res.status_code == 200
    conv_list = list_res.json()
    assert any(c["id"] == conv_id for c in conv_list)

    # 3. Get conversation detail
    detail_res = client.get(f"/api/v1/chat/conversations/{conv_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == conv_id

    # 4. Update title
    patch_res = client.patch(
        f"/api/v1/chat/conversations/{conv_id}",
        json={"title": "Updated Strategy Discussion"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Updated Strategy Discussion"

    # 5. Delete conversation
    del_res = client.delete(f"/api/v1/chat/conversations/{conv_id}", headers=headers)
    assert del_res.status_code == 200

    # 6. Verify 404 after deletion
    get_del_res = client.get(f"/api/v1/chat/conversations/{conv_id}", headers=headers)
    assert get_del_res.status_code == 404


def test_send_message_grounded_answer(client: TestClient):
    """Verify posting a question to a conversation returns grounded answer with citations."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # Upload & process document
    content = b"# Q3 Financial Performance\nOperating revenue exceeded forecasts reaching $25M."
    files = {"file": ("q3_performance.txt", io.BytesIO(content), "text/plain")}
    up = client.post("/api/v1/documents/upload", files=files, headers=headers)
    assert up.status_code == 201
    doc_id = up.json()["id"]
    client.post(f"/api/v1/documents/{doc_id}/process?background=false", headers=headers)

    # Create conversation
    create_res = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Finance Q&A"},
        headers=headers,
    )
    conv_id = create_res.json()["id"]

    # Send inquiry
    msg_res = client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={
            "question": "What was the operating revenue in Q3?",
            "retrieval_mode": "hybrid",
            "stream": False,
        },
        headers=headers,
    )
    assert msg_res.status_code == 200
    data = msg_res.json()
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert data["conversation_id"] == conv_id
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["document_id"] == doc_id
    assert "revenue" in data["citations"][0]["quote"].lower()

    # List messages
    msgs_res = client.get(f"/api/v1/chat/conversations/{conv_id}/messages", headers=headers)
    assert msgs_res.status_code == 200
    msgs = msgs_res.json()
    assert len(msgs) == 2
    assert msgs[0]["sender_type"] == "user"
    assert msgs[1]["sender_type"] == "assistant"
    assert len(msgs[1]["citations"]) >= 1


def test_send_message_streaming_sse(client: TestClient):
    """Verify SSE streaming message endpoint emits token and done events."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    create_res = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Streaming Test"},
        headers=headers,
    )
    conv_id = create_res.json()["id"]

    stream_res = client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={
            "question": "Summarize this document.",
            "stream": True,
        },
        headers=headers,
    )
    assert stream_res.status_code == 200
    assert "text/event-stream" in stream_res.headers["content-type"]

    body = stream_res.text
    assert "event: token" in body
    assert "event: done" in body


def test_chat_api_workspace_isolation(client: TestClient):
    """Verify User B in Workspace B cannot access or send messages in Workspace A's conversation."""
    uid_a = f"usera-{uuid.uuid4().hex[:6]}"
    tok_a = make_test_token(user_id=uid_a, email=f"{uid_a}@udip.local")
    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok_a}"}).json()
    ws_a = me_a["workspaces"][0]["id"]
    headers_a = {"Authorization": f"Bearer {tok_a}", "X-Workspace-ID": ws_a}

    conv_a = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Workspace A Secret"},
        headers=headers_a,
    ).json()
    conv_id = conv_a["id"]

    # User B setup
    uid_b = f"userb-{uuid.uuid4().hex[:6]}"
    tok_b = make_test_token(user_id=uid_b, email=f"{uid_b}@udip.local")
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok_b}"}).json()
    ws_b = me_b["workspaces"][0]["id"]
    headers_b = {"Authorization": f"Bearer {tok_b}", "X-Workspace-ID": ws_b}

    # User B attempts to access Workspace A conversation
    get_res = client.get(f"/api/v1/chat/conversations/{conv_id}", headers=headers_b)
    assert get_res.status_code == 404

    # User B attempts to send message into Workspace A conversation
    msg_res = client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"question": "Sneak into conversation"},
        headers=headers_b,
    )
    assert msg_res.status_code == 404
