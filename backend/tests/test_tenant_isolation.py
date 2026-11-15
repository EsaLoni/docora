"""Comprehensive Multi-Tenant Isolation & Cross-Tenant Rejection Tests."""

import asyncio
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.chat import Conversation
from app.models.document import Document
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from tests.conftest import make_test_token


def test_user_can_access_own_workspace(client: TestClient):
    """Verify user can access their own workspace details."""
    uid = f"user-a-{uuid.uuid4().hex[:8]}"
    email = f"user_a_{uuid.uuid4().hex[:6]}@domain.com"
    token = make_test_token(user_id=uid, email=email)

    # Resolve own workspace
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    ws_id = me.json()["workspaces"][0]["id"]

    # Access own workspace
    res = client.get(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {token}", "X-Workspace-ID": ws_id},
    )
    assert res.status_code == 200
    assert res.json()["id"] == ws_id


def test_user_a_cannot_access_user_b_workspace(client: TestClient):
    """Verify User A attempting to access User B's workspace is rejected with 403 Forbidden."""
    # 1. Setup User A
    token_a = make_test_token(user_id=f"user-a-{uuid.uuid4().hex[:6]}", email=f"user_a_{uuid.uuid4().hex[:6]}@test.local")
    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert me_a.status_code == 200

    # 2. Setup User B
    token_b = make_test_token(user_id=f"user-b-{uuid.uuid4().hex[:6]}", email=f"user_b_{uuid.uuid4().hex[:6]}@test.local")
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"})
    assert me_b.status_code == 200
    ws_b_id = me_b.json()["workspaces"][0]["id"]

    # 3. User A attempts to access User B's workspace
    res = client.get(
        f"/api/v1/workspaces/{ws_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": ws_b_id},
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "WORKSPACE_ACCESS_DENIED"


def test_cross_tenant_document_access_rejected(client: TestClient, session_factory: async_sessionmaker[AsyncSession]):
    """Verify User A cannot read User B's documents via either workspace path."""
    # Setup User A and User B
    token_a = make_test_token(user_id=f"ua-{uuid.uuid4().hex[:6]}", email=f"ua_{uuid.uuid4().hex[:6]}@t.com")
    token_b = make_test_token(user_id=f"ub-{uuid.uuid4().hex[:6]}", email=f"ub_{uuid.uuid4().hex[:6]}@t.com")

    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()

    ws_a_id = uuid.UUID(me_a["workspaces"][0]["id"])
    ws_b_id = uuid.UUID(me_b["workspaces"][0]["id"])
    user_b_id = uuid.UUID(me_b["id"])

    # Seed Document in Workspace B
    doc_b_id = uuid.uuid4()
    async def seed_doc():
        async with session_factory() as s:
            doc = Document(
                id=doc_b_id,
                workspace_id=ws_b_id,
                user_id=user_b_id,
                title="Confidential Document B",
                filename="confidential.pdf",
                file_path="/storage/b/confidential.bin",
                file_size_bytes=2048,
                mime_type="application/pdf",
                file_hash="hash-b-12345",
                status="READY",
            )
            s.add(doc)
            await s.commit()

    asyncio.run(seed_doc())

    # User B can view their own document
    res_b = client.get(
        f"/api/v1/workspaces/{ws_b_id}/documents/{doc_b_id}",
        headers={"Authorization": f"Bearer {token_b}", "X-Workspace-ID": str(ws_b_id)},
    )
    assert res_b.status_code == 200
    assert res_b.json()["title"] == "Confidential Document B"

    # Attack 1: User A targets Workspace B directly -> Rejected with 403 Workspace Access Denied
    res_a_direct = client.get(
        f"/api/v1/workspaces/{ws_b_id}/documents/{doc_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": str(ws_b_id)},
    )
    assert res_a_direct.status_code == 403

    # Attack 2: User A targets own Workspace A with User B's doc_id -> Rejected with 404 (document not in workspace)
    res_a_sneaky = client.get(
        f"/api/v1/workspaces/{ws_a_id}/documents/{doc_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": str(ws_a_id)},
    )
    assert res_a_sneaky.status_code == 404
    assert res_a_sneaky.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_cross_tenant_conversation_access_rejected(client: TestClient, session_factory: async_sessionmaker[AsyncSession]):
    """Verify User A cannot read User B's conversations."""
    token_a = make_test_token(user_id=f"ca-{uuid.uuid4().hex[:6]}", email=f"ca_{uuid.uuid4().hex[:6]}@t.com")
    token_b = make_test_token(user_id=f"cb-{uuid.uuid4().hex[:6]}", email=f"cb_{uuid.uuid4().hex[:6]}@t.com")

    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()

    ws_a_id = uuid.UUID(me_a["workspaces"][0]["id"])
    ws_b_id = uuid.UUID(me_b["workspaces"][0]["id"])
    user_b_id = uuid.UUID(me_b["id"])

    conv_b_id = uuid.uuid4()
    async def seed_conv():
        async with session_factory() as s:
            conv = Conversation(
                id=conv_b_id,
                workspace_id=ws_b_id,
                user_id=user_b_id,
                title="Secret Project B Chat",
            )
            s.add(conv)
            await s.commit()

    asyncio.run(seed_conv())

    # User A attempting access via Workspace B -> 403
    res1 = client.get(
        f"/api/v1/workspaces/{ws_b_id}/conversations/{conv_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": str(ws_b_id)},
    )
    assert res1.status_code == 403

    # User A attempting access via Workspace A -> 404
    res2 = client.get(
        f"/api/v1/workspaces/{ws_a_id}/conversations/{conv_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": str(ws_a_id)},
    )
    assert res2.status_code == 404


def test_cross_tenant_processing_job_access_rejected(client: TestClient, session_factory: async_sessionmaker[AsyncSession]):
    """Verify User A cannot read User B's processing jobs."""
    token_a = make_test_token(user_id=f"ja-{uuid.uuid4().hex[:6]}", email=f"ja_{uuid.uuid4().hex[:6]}@t.com")
    token_b = make_test_token(user_id=f"jb-{uuid.uuid4().hex[:6]}", email=f"jb_{uuid.uuid4().hex[:6]}@t.com")

    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()

    ws_a_id = uuid.UUID(me_a["workspaces"][0]["id"])
    ws_b_id = uuid.UUID(me_b["workspaces"][0]["id"])
    user_b_id = uuid.UUID(me_b["id"])

    job_b_id = uuid.uuid4()
    async def seed_job():
        async with session_factory() as s:
            doc = Document(
                workspace_id=ws_b_id,
                user_id=user_b_id,
                title="Doc B",
                filename="b.pdf",
                file_path="/storage/b.bin",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="h-b",
            )
            s.add(doc)
            await s.flush()

            job = ProcessingJob(
                id=job_b_id,
                workspace_id=ws_b_id,
                document_id=doc.id,
                status="PROCESSING",
                progress_percentage=45,
            )
            s.add(job)
            await s.commit()

    asyncio.run(seed_job())

    # User A querying job via Workspace B -> 403
    res1 = client.get(
        f"/api/v1/workspaces/{ws_b_id}/jobs/{job_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": str(ws_b_id)},
    )
    assert res1.status_code == 403

    # User A querying job via Workspace A -> 404
    res2 = client.get(
        f"/api/v1/workspaces/{ws_a_id}/jobs/{job_b_id}",
        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-ID": str(ws_a_id)},
    )
    assert res2.status_code == 404


def test_cross_tenant_database_query_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify database queries with workspace filtering never leak other tenants' data."""
    async def _test():
        async with session_factory() as session:
            # Create two workspaces
            u1 = User(email=f"u1_{uuid.uuid4().hex[:6]}@db.com")
            u2 = User(email=f"u2_{uuid.uuid4().hex[:6]}@db.com")
            session.add_all([u1, u2])
            await session.commit()

            ws1 = Workspace(name="WS1", slug=f"ws1-{uuid.uuid4().hex[:6]}", owner_id=u1.id)
            ws2 = Workspace(name="WS2", slug=f"ws2-{uuid.uuid4().hex[:6]}", owner_id=u2.id)
            session.add_all([ws1, ws2])
            await session.commit()

            # Add documents
            d1 = Document(
                workspace_id=ws1.id,
                user_id=u1.id,
                title="WS1 Document",
                filename="doc1.pdf",
                file_path="/p1",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="h1",
            )
            d2 = Document(
                workspace_id=ws2.id,
                user_id=u2.id,
                title="WS2 Document",
                filename="doc2.pdf",
                file_path="/p2",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="h2",
            )
            session.add_all([d1, d2])
            await session.commit()

            # Query scoped to Workspace 1
            stmt_ws1 = select(Document).where(Document.workspace_id == ws1.id)
            docs_ws1 = (await session.execute(stmt_ws1)).scalars().all()

            assert len(docs_ws1) == 1
            assert docs_ws1[0].title == "WS1 Document"
            # Ensure d2 is NOT in the results
            assert all(d.workspace_id == ws1.id for d in docs_ws1)

    asyncio.run(_test())
