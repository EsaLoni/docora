"""Integration Tests for Actions, Reminders, and Notifications REST APIs."""

from datetime import datetime, timedelta, timezone
import io
import uuid
import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_actions_crud_api(client: TestClient):
    """Verify action item CRUD, status progression, and deletion."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Create action item
    create_res = client.post(
        "/api/v1/actions",
        json={
            "title": "Verify Security Certificate Expiration",
            "description": "SSL certificate renews soon.",
            "priority": "high",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
            "create_reminder": True,
            "reminder_lead_time_minutes": 60,
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    item = create_res.json()
    item_id = item["id"]
    assert item["title"] == "Verify Security Certificate Expiration"
    assert item["priority"] == "high"
    assert item["status"] == "pending"

    # 2. List action items
    list_res = client.get("/api/v1/actions", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(i["id"] == item_id for i in list_data["items"])

    # 3. Get single action item
    get_res = client.get(f"/api/v1/actions/{item_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == item_id

    # 4. Update action item
    update_res = client.patch(
        f"/api/v1/actions/{item_id}",
        json={"priority": "urgent", "notes": "Escalated by security team"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["priority"] == "urgent"
    assert update_res.json()["notes"] == "Escalated by security team"

    # 5. Complete action item
    comp_res = client.post(f"/api/v1/actions/{item_id}/complete", headers=headers)
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"
    assert comp_res.json()["completed_at"] is not None

    # 6. Reopen action item
    reopen_res = client.post(f"/api/v1/actions/{item_id}/reopen", headers=headers)
    assert reopen_res.status_code == 200
    assert reopen_res.json()["status"] == "in_progress"
    assert reopen_res.json()["completed_at"] is None

    # 7. Dismiss action item
    dismiss_res = client.post(f"/api/v1/actions/{item_id}/dismiss", headers=headers)
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["status"] == "dismissed"

    # 8. Delete action item
    del_res = client.delete(f"/api/v1/actions/{item_id}", headers=headers)
    assert del_res.status_code == 204

    assert client.get(f"/api/v1/actions/{item_id}", headers=headers).status_code == 404


def test_action_discovery_and_approval_api(client: TestClient):
    """Verify document discovery, candidate suggestions, and user approval workflow."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Upload & process test document
    doc_content = b"Payment of $4,500 is due on November 30, 2026 for server hosting. This contract shall renew on December 15, 2026."
    files = {"file": ("contract.txt", io.BytesIO(doc_content), "text/plain")}
    upload_res = client.post("/api/v1/documents/upload", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    proc_res = client.post(f"/api/v1/documents/{doc_id}/process?background=false", headers=headers)
    assert proc_res.status_code == 200

    # 2. Trigger action discovery
    disc_res = client.post(f"/api/v1/actions/discover/{doc_id}?persist=true", headers=headers)
    assert disc_res.status_code == 200
    disc_data = disc_res.json()
    assert disc_data["total_discovered"] >= 1

    # 3. List candidate suggestions
    sugg_res = client.get(f"/api/v1/actions/suggestions?document_id={doc_id}", headers=headers)
    assert sugg_res.status_code == 200
    suggs = sugg_res.json()["items"]
    assert len(suggs) >= 1
    assert all(s["status"] == "suggested" for s in suggs)

    target_sugg = suggs[0]
    sugg_id = target_sugg["id"]

    # 4. User Approval Workflow
    approve_res = client.post(
        f"/api/v1/actions/suggestions/{sugg_id}/approve",
        json={
            "title": f"Approved: {target_sugg['title']}",
            "priority": "high",
            "create_reminder": True,
        },
        headers=headers,
    )
    assert approve_res.status_code == 200
    approved_item = approve_res.json()
    assert approved_item["title"].startswith("Approved:")
    assert approved_item["origin"] == "extracted"

    # Suggestion should now be approved
    updated_suggs = client.get(f"/api/v1/actions/suggestions?status=approved", headers=headers).json()["items"]
    assert any(s["id"] == sugg_id for s in updated_suggs)

    # 5. Dismiss second suggestion if available
    if len(suggs) > 1:
        dismiss_sugg_id = suggs[1]["id"]
        dismiss_res = client.post(
            f"/api/v1/actions/suggestions/{dismiss_sugg_id}/dismiss",
            headers=headers,
        )
        assert dismiss_res.status_code == 200
        assert dismiss_res.json()["status"] == "dismissed"


def test_reminders_and_notifications_api(client: TestClient):
    """Verify reminders CRUD, snooze, notifications listing, and read status."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id}

    # 1. Create reminder
    due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    rem_res = client.post(
        "/api/v1/reminders",
        json={
            "title": "Quarterly Tax Filing Deadline",
            "description": "Submit quarterly filings to state department.",
            "due_date": due,
            "recurrence_rule": "FREQ=MONTHLY",
        },
        headers=headers,
    )
    assert rem_res.status_code == 201
    reminder = rem_res.json()
    rem_id = reminder["id"]
    assert reminder["title"] == "Quarterly Tax Filing Deadline"
    assert reminder["status"] == "scheduled"

    # 2. List reminders
    list_rem = client.get("/api/v1/reminders", headers=headers)
    assert list_rem.status_code == 200
    assert list_rem.json()["total"] >= 1

    # 3. Snooze reminder
    snooze_until = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    snooze_res = client.post(
        f"/api/v1/reminders/{rem_id}/snooze",
        json={"snooze_until": snooze_until},
        headers=headers,
    )
    assert snooze_res.status_code == 200
    assert snooze_res.json()["status"] == "snoozed"

    # 4. Cancel reminder
    cancel_res = client.post(f"/api/v1/reminders/{rem_id}/cancel", headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # 5. Notifications endpoints
    notifs_res = client.get("/api/v1/notifications", headers=headers)
    assert notifs_res.status_code == 200

    unread_res = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert unread_res.status_code == 200
    assert "unread_count" in unread_res.json()

    read_all_res = client.post("/api/v1/notifications/read-all", headers=headers)
    assert read_all_res.status_code == 200


def test_actions_workspace_isolation_api(client: TestClient):
    """Verify cross-workspace isolation on action items and reminders."""
    # User A in Workspace A
    uid_a = f"usera-{uuid.uuid4().hex[:6]}"
    token_a = make_test_token(user_id=uid_a, email=f"{uid_a}@udip.local")
    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    ws_a_id = me_a["workspaces"][0]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_a_id}

    # User B in Workspace B
    uid_b = f"userb-{uuid.uuid4().hex[:6]}"
    token_b = make_test_token(user_id=uid_b, email=f"{uid_b}@udip.local")
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()
    ws_b_id = me_b["workspaces"][0]["id"]
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Workspace-ID": ws_b_id}

    # User A creates action item
    item_res = client.post(
        "/api/v1/actions",
        json={"title": "Workspace A Secret Task"},
        headers=headers_a,
    )
    item_id = item_res.json()["id"]

    # User B tries to read, update, or delete User A's item -> 404
    assert client.get(f"/api/v1/actions/{item_id}", headers=headers_b).status_code == 404
    assert client.patch(f"/api/v1/actions/{item_id}", json={"title": "Hacked"}, headers=headers_b).status_code == 404
    assert client.delete(f"/api/v1/actions/{item_id}", headers=headers_b).status_code == 404
