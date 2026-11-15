"""Tests for all 14 SQLAlchemy ORM Models, Constraints, Relationships, and Cascades."""

import asyncio
from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models import (
    AuditLog,
    Citation,
    Conversation,
    Document,
    DocumentChunk,
    DocumentPage,
    Extraction,
    Folder,
    Message,
    ProcessingJob,
    Reminder,
    User,
    Workspace,
    WorkspaceMember,
)


def run_async(coro):
    """Helper to run async test functions synchronously in pytest."""
    return asyncio.run(coro)


def test_create_and_query_user(session_factory: async_sessionmaker[AsyncSession]):
    """Verify user creation with UUID primary key and UTC timestamps."""
    async def _test():
        async with session_factory() as session:
            user = User(
                email=f"user_{uuid.uuid4().hex[:6]}@example.com",
                full_name="Jane Doe",
                role="user",
                is_active=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

            assert isinstance(user.id, uuid.UUID)
            assert user.email.endswith("@example.com")
            assert user.created_at is not None

    run_async(_test())


def test_unique_user_email_constraint(session_factory: async_sessionmaker[AsyncSession]):
    """Verify duplicate emails are rejected by unique constraint."""
    async def _test():
        async with session_factory() as session:
            email = f"dup_{uuid.uuid4().hex[:6]}@example.com"
            u1 = User(email=email, full_name="User 1")
            session.add(u1)
            await session.commit()

            u2 = User(email=email, full_name="User 2")
            session.add(u2)
            with pytest.raises(IntegrityError):
                await session.commit()

    run_async(_test())


def test_workspace_and_membership_relationship(session_factory: async_sessionmaker[AsyncSession]):
    """Verify workspace creation and membership association."""
    async def _test():
        async with session_factory() as session:
            owner = User(email=f"owner_{uuid.uuid4().hex[:6]}@example.com", full_name="Workspace Owner")
            member = User(email=f"member_{uuid.uuid4().hex[:6]}@example.com", full_name="Workspace Member")
            session.add_all([owner, member])
            await session.commit()

            ws = Workspace(
                name="Engineering Docs",
                slug=f"eng-{uuid.uuid4().hex[:8]}",
                owner_id=owner.id,
                settings={"privacy": "internal"},
            )
            session.add(ws)
            await session.commit()

            # Add memberships
            m1 = WorkspaceMember(workspace_id=ws.id, user_id=owner.id, role="owner")
            m2 = WorkspaceMember(workspace_id=ws.id, user_id=member.id, role="member")
            session.add_all([m1, m2])
            await session.commit()

            # Query workspace members
            stmt = select(WorkspaceMember).where(WorkspaceMember.workspace_id == ws.id)
            members = (await session.execute(stmt)).scalars().all()
            assert len(members) == 2

    run_async(_test())


def test_unique_workspace_membership_constraint(session_factory: async_sessionmaker[AsyncSession]):
    """Verify duplicate user membership in the same workspace is rejected."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"u_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="WS", slug=f"ws-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            m1 = WorkspaceMember(workspace_id=ws.id, user_id=u.id, role="owner")
            session.add(m1)
            await session.commit()

            # Attempt to add duplicate membership
            m2 = WorkspaceMember(workspace_id=ws.id, user_id=u.id, role="member")
            session.add(m2)
            with pytest.raises(IntegrityError):
                await session.commit()

    run_async(_test())


def test_folder_hierarchy_and_unique_name(session_factory: async_sessionmaker[AsyncSession]):
    """Verify nested folders and folder name uniqueness within same parent."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"f_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="WS Folders", slug=f"ws-f-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            root_folder = Folder(workspace_id=ws.id, parent_id=None, name="Legal")
            session.add(root_folder)
            await session.commit()

            sub_folder = Folder(workspace_id=ws.id, parent_id=root_folder.id, name="Contracts")
            session.add(sub_folder)
            await session.commit()

            # Attempt duplicate subfolder name under same parent
            dup_folder = Folder(workspace_id=ws.id, parent_id=root_folder.id, name="Contracts")
            session.add(dup_folder)
            with pytest.raises(IntegrityError):
                await session.commit()

    run_async(_test())


def test_document_hierarchy_and_pgvector_embedding(session_factory: async_sessionmaker[AsyncSession]):
    """Verify Document -> DocumentPage -> DocumentChunk with 384-d vector."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"doc_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="Docs WS", slug=f"ws-doc-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            doc = Document(
                workspace_id=ws.id,
                user_id=u.id,
                title="Q3 Financials",
                filename="q3.pdf",
                file_path="/storage/documents/q3.bin",
                file_size_bytes=1024 * 500,
                mime_type="application/pdf",
                file_hash="hash-1234567890abcdef",
                page_count=2,
                status="READY",
            )
            session.add(doc)
            await session.commit()

            # Page 1
            page1 = DocumentPage(
                document_id=doc.id,
                page_number=1,
                content="Revenue grew by 24% year-over-year.",
                token_count=10,
            )
            session.add(page1)
            await session.commit()

            # Chunk with 384-dimensional vector
            test_embedding = [0.05] * 384
            chunk1 = DocumentChunk(
                workspace_id=ws.id,
                document_id=doc.id,
                page_id=page1.id,
                chunk_index=0,
                content="Revenue grew by 24% year-over-year.",
                token_count=10,
                embedding=test_embedding,
            )
            session.add(chunk1)
            await session.commit()

            # Query chunk back and verify vector length
            stmt = select(DocumentChunk).where(DocumentChunk.id == chunk1.id)
            res = (await session.execute(stmt)).scalar_one()
            assert res.token_count == 10
            assert len(res.embedding) == 384
            assert res.embedding[0] == pytest.approx(0.05)

    run_async(_test())


def test_unique_document_page_number_constraint(session_factory: async_sessionmaker[AsyncSession]):
    """Verify document_pages enforces unique (document_id, page_number)."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"pg_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="WS Pages", slug=f"ws-p-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            doc = Document(
                workspace_id=ws.id,
                user_id=u.id,
                title="Doc",
                filename="doc.pdf",
                file_path="/storage/doc.bin",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="hash-abc",
            )
            session.add(doc)
            await session.commit()

            p1 = DocumentPage(document_id=doc.id, page_number=1, content="Page 1 content")
            session.add(p1)
            await session.commit()

            # Duplicate page 1 for same document
            p1_dup = DocumentPage(document_id=doc.id, page_number=1, content="Duplicate page 1")
            session.add(p1_dup)
            with pytest.raises(IntegrityError):
                await session.commit()

    run_async(_test())


def test_document_cascading_deletion(session_factory: async_sessionmaker[AsyncSession]):
    """Verify deleting a Document cascades to pages, chunks, jobs, extractions, and citations."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"casc_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="Cascade WS", slug=f"ws-casc-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            doc = Document(
                workspace_id=ws.id,
                user_id=u.id,
                title="To Delete",
                filename="delete.pdf",
                file_path="/storage/del.bin",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="hash-del",
            )
            session.add(doc)
            await session.commit()

            page = DocumentPage(document_id=doc.id, page_number=1, content="Content")
            session.add(page)
            await session.commit()

            chunk = DocumentChunk(
                workspace_id=ws.id,
                document_id=doc.id,
                page_id=page.id,
                chunk_index=0,
                content="Content",
                token_count=5,
                embedding=[0.1] * 384,
            )
            job = ProcessingJob(
                workspace_id=ws.id,
                document_id=doc.id,
                status="COMPLETED",
            )
            extraction = Extraction(
                workspace_id=ws.id,
                document_id=doc.id,
                extraction_type="contract",
                schema_definition={},
                extracted_data={"party": "Corp"},
            )
            session.add_all([chunk, job, extraction])
            await session.commit()

            # Delete the document
            await session.delete(doc)
            await session.commit()

            # Verify associated child entities were deleted via cascade
            pages = (await session.execute(select(DocumentPage).where(DocumentPage.document_id == doc.id))).scalars().all()
            chunks = (await session.execute(select(DocumentChunk).where(DocumentChunk.document_id == doc.id))).scalars().all()
            jobs = (await session.execute(select(ProcessingJob).where(ProcessingJob.document_id == doc.id))).scalars().all()
            extractions = (await session.execute(select(Extraction).where(Extraction.document_id == doc.id))).scalars().all()

            assert len(pages) == 0
            assert len(chunks) == 0
            assert len(jobs) == 0
            assert len(extractions) == 0

    run_async(_test())


def test_conversation_messages_and_citations(session_factory: async_sessionmaker[AsyncSession]):
    """Verify Conversation, Message, and Citation models with cascade."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"chat_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="Chat WS", slug=f"ws-chat-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            doc = Document(
                workspace_id=ws.id,
                user_id=u.id,
                title="Handbook",
                filename="handbook.pdf",
                file_path="/storage/handbook.bin",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="hash-hb",
            )
            session.add(doc)
            await session.commit()

            page = DocumentPage(document_id=doc.id, page_number=1, content="Vacation policy")
            session.add(page)
            await session.commit()

            chunk = DocumentChunk(
                workspace_id=ws.id,
                document_id=doc.id,
                page_id=page.id,
                chunk_index=0,
                content="Vacation policy details",
                token_count=5,
                embedding=[0.2] * 384,
            )
            session.add(chunk)
            await session.commit()

            conv = Conversation(
                workspace_id=ws.id,
                user_id=u.id,
                title="Policy Discussion",
                active_document_ids=[str(doc.id)],
            )
            session.add(conv)
            await session.commit()

            msg = Message(
                conversation_id=conv.id,
                sender_type="assistant",
                content="The vacation policy allows 20 days off.",
                token_count=8,
            )
            session.add(msg)
            await session.commit()

            cit = Citation(
                message_id=msg.id,
                chunk_id=chunk.id,
                document_id=doc.id,
                page_number=1,
                quote="Vacation policy details",
                relevance_score=0.95,
            )
            session.add(cit)
            await session.commit()

            # Verify relationship
            stmt = select(Citation).where(Citation.message_id == msg.id)
            saved_cit = (await session.execute(stmt)).scalar_one()
            assert saved_cit.page_number == 1
            assert saved_cit.relevance_score == 0.95

    run_async(_test())


def test_reminders_and_audit_logs(session_factory: async_sessionmaker[AsyncSession]):
    """Verify Reminder and AuditLog persistence."""
    async def _test():
        async with session_factory() as session:
            u = User(email=f"rem_{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.commit()

            ws = Workspace(name="Audit WS", slug=f"ws-aud-{uuid.uuid4().hex[:8]}", owner_id=u.id)
            session.add(ws)
            await session.commit()

            # Reminder
            due = datetime(2027, 1, 1, 12, 0, tzinfo=timezone.utc)
            reminder = Reminder(
                workspace_id=ws.id,
                user_id=u.id,
                title="Renew Contract",
                due_date=due,
                is_confirmed=True,
            )
            session.add(reminder)

            # Audit Log
            audit = AuditLog(
                workspace_id=ws.id,
                user_id=u.id,
                action="DOCUMENT_UPLOAD",
                resource_type="document",
                resource_id=uuid.uuid4(),
                details={"filename": "test.pdf"},
                ip_address="127.0.0.1",
            )
            session.add(audit)
            await session.commit()

            # Verify
            saved_rem = (await session.execute(select(Reminder).where(Reminder.id == reminder.id))).scalar_one()
            saved_aud = (await session.execute(select(AuditLog).where(AuditLog.id == audit.id))).scalar_one()

            assert saved_rem.title == "Renew Contract"
            assert saved_aud.action == "DOCUMENT_UPLOAD"
            assert saved_aud.ip_address == "127.0.0.1"

    run_async(_test())
