"""Integration Tests for Folder Management and Circular Hierarchy Prevention."""

import uuid
import pytest
from fastapi.testclient import TestClient
from tests.conftest import make_test_token


def test_folder_crud_and_hierarchy(client: TestClient):
    """Verify creating, listing, renaming, and deleting folders."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    # 1. Create root folder
    res1 = client.post(
        "/api/v1/folders",
        json={"name": "Finance", "color": "#10B981"},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res1.status_code == 201
    f1_id = res1.json()["id"]

    # 2. Create nested subfolder
    res2 = client.post(
        "/api/v1/folders",
        json={"name": "2026 Invoices", "parent_id": f1_id, "color": "#3B82F6"},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res2.status_code == 201
    f2_id = res2.json()["id"]
    assert res2.json()["parent_id"] == f1_id

    # 3. Prevent duplicate folder name in same parent
    dup_res = client.post(
        "/api/v1/folders",
        json={"name": "2026 Invoices", "parent_id": f1_id},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert dup_res.status_code == 409

    # 4. List folders
    list_res = client.get(
        "/api/v1/folders",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 2

    # 5. Rename folder
    patch_res = client.patch(
        f"/api/v1/folders/{f2_id}",
        json={"name": "2026 Paid Invoices"},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "2026 Paid Invoices"

    # 6. Delete folder
    del_res = client.delete(
        f"/api/v1/folders/{f2_id}",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert del_res.status_code == 204


def test_circular_folder_hierarchy_prevention(client: TestClient):
    """Verify system blocks moving a folder into itself or its descendants."""
    uid = f"user-{uuid.uuid4().hex[:6]}"
    token = make_test_token(user_id=uid, email=f"{uid}@udip.local")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    ws_id = me["workspaces"][0]["id"]

    # Create Folder A
    res_a = client.post(
        "/api/v1/folders",
        json={"name": "Folder A"},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    fa_id = res_a.json()["id"]

    # Create Folder B inside Folder A (A -> B)
    res_b = client.post(
        "/api/v1/folders",
        json={"name": "Folder B", "parent_id": fa_id},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    fb_id = res_b.json()["id"]

    # Create Folder C inside Folder B (A -> B -> C)
    res_c = client.post(
        "/api/v1/folders",
        json={"name": "Folder C", "parent_id": fb_id},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    fc_id = res_c.json()["id"]

    # 1. Attempt to move Folder A into itself (parent_id = fa_id)
    self_move = client.patch(
        f"/api/v1/folders/{fa_id}",
        json={"parent_id": fa_id},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert self_move.status_code == 400
    assert self_move.json()["error"]["code"] == "CIRCULAR_FOLDER_HIERARCHY"

    # 2. Attempt to move Folder A into its descendant Folder C (A -> B -> C -> A)
    circ_move = client.patch(
        f"/api/v1/folders/{fa_id}",
        json={"parent_id": fc_id},
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert circ_move.status_code == 400
    assert circ_move.json()["error"]["code"] == "CIRCULAR_FOLDER_HIERARCHY"
