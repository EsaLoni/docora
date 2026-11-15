"""Unit and Integration Tests for UDIP Conversation and Message Management.

Tests:
- Conversation CRUD operations
- Message and citation persistence
- Workspace boundary enforcement
- Cascade semantics (documents preserved on conversation deletion)
"""

import asyncio
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.chat import Conversation, Message
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.user import User
from app.models.workspace import Workspace
from app.services.rag.conversation_manager import ConversationManager, ConversationNotFoundError
from app.services.rag.models import CitationDTO


def test_conversation_lifecycle_and_messages(session_factory: async_sessionmaker[AsyncSession]):
    """Verify creating, listing, renaming, adding messages, and deleting conversations."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email="conv_user@udip.local", full_name="Conv User", is_active=True)
            ws = Workspace(id=uuid.uuid4(), name="Conv WS", slug=f"cws-{uuid.uuid4().hex[:8]}", owner_id=user.id, settings={})
            session.add_all([user, ws])
            await session.commit()

            manager = ConversationManager()

            # 1. Create conversation
            conv = await manager.create_conversation(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                title="Q3 Strategy Q&A",
                active_document_ids=["doc-abc"],
            )
            assert conv.id is not None
            assert conv.title == "Q3 Strategy Q&A"
            assert "doc-abc" in conv.active_document_ids

            # 2. List conversations
            convs = await manager.list_conversations(session, ws.id, user.id)
            assert len(convs) == 1
            assert convs[0].id == conv.id

            # 3. Add user and assistant messages
            user_msg = await manager.persist_user_message(session, conv.id, "What are the Q3 targets?")
            assert user_msg.sender_type == "user"

            # Create document & chunk to support citation
            doc = Document(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                user_id=user.id,
                title="Q3 Target Doc",
                filename="targets.pdf",
                file_path="/targets.pdf",
                file_size_bytes=100,
                mime_type="application/pdf",
                file_hash="h-target",
                page_count=1,
                status="READY",
                is_deleted=False,
            )
            session.add(doc)
            await session.flush()

            page = DocumentPage(id=uuid.uuid4(), document_id=doc.id, page_number=1, content="Target is $10M.")
            session.add(page)
            await session.flush()

            chunk = DocumentChunk(
                id=uuid.uuid4(),
                workspace_id=ws.id,
                document_id=doc.id,
                page_id=page.id,
                chunk_index=0,
                content=page.content,
                token_count=5,
                embedding=[0.0] * 384,
                metadata_json={},
            )
            session.add(chunk)
            await session.commit()

            cite_dto = CitationDTO(
                document_id=str(doc.id),
                document_filename="targets.pdf",
                chunk_id=str(chunk.id),
                page_number=1,
                quote="Target is $10M.",
                relevance_score=0.95,
                citation_index=1,
            )
            assistant_msg = await manager.persist_assistant_message(
                session, conv.id, "Target is $10M [Source 1].", [cite_dto]
            )
            assert assistant_msg.sender_type == "assistant"

            # 4. Fetch messages with citations
            messages = await manager.get_messages(session, ws.id, conv.id)
            assert len(messages) == 2
            assert messages[0].sender_type == "user"
            assert messages[1].sender_type == "assistant"
            assert len(messages[1].citations) == 1
            assert messages[1].citations[0].quote == "Target is $10M."

            # 5. Update title
            updated = await manager.update_conversation(session, ws.id, conv.id, title="Renamed Q3 Q&A")
            assert updated.title == "Renamed Q3 Q&A"

            # 6. Delete conversation
            deleted = await manager.delete_conversation(session, ws.id, conv.id)
            assert deleted is True

            # Confirm conversation and messages gone
            assert await manager.get_conversation(session, ws.id, conv.id) is None
            # Confirm source document was NOT deleted
            doc_check = (await session.execute(select(Document).where(Document.id == doc.id))).scalar_one_or_none()
            assert doc_check is not None

    asyncio.run(_test())


def test_conversation_workspace_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify tenant isolation: User B in Workspace B cannot access Workspace A conversations."""
    async def _test():
        async with session_factory() as session:
            user_a = User(id=uuid.uuid4(), email="usera@udip.local", full_name="User A", is_active=True)
            user_b = User(id=uuid.uuid4(), email="userb@udip.local", full_name="User B", is_active=True)
            ws_a = Workspace(id=uuid.uuid4(), name="WS A", slug=f"wsa-{uuid.uuid4().hex[:8]}", owner_id=user_a.id, settings={})
            ws_b = Workspace(id=uuid.uuid4(), name="WS B", slug=f"wsb-{uuid.uuid4().hex[:8]}", owner_id=user_b.id, settings={})
            session.add_all([user_a, user_b, ws_a, ws_b])
            await session.commit()

            manager = ConversationManager()
            conv_a = await manager.create_conversation(session, ws_a.id, user_a.id, "Secret Thread A")

            # Workspace B lookup should return None
            assert await manager.get_conversation(session, ws_b.id, conv_a.id) is None

            # Workspace B cannot fetch messages
            with pytest.raises(ConversationNotFoundError):
                await manager.get_messages(session, ws_b.id, conv_a.id)

            # Workspace B cannot delete
            assert await manager.delete_conversation(session, ws_b.id, conv_a.id) is False

    asyncio.run(_test())
