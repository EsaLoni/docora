"""Conversation, Message, and Citation Persistence Manager.

Manages conversation state, multi-tenant workspace security, and historical message lineage.
"""

from typing import List, Optional
import uuid
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import UDIPException
from app.core.logging import get_logger
from app.models.chat import Citation, Conversation, Message
from app.services.extractors.base import estimate_token_count
from app.services.rag.models import CitationDTO

logger = get_logger("rag.conversation_manager")


class ConversationNotFoundError(UDIPException):
    def __init__(self, conv_id: str) -> None:
        super().__init__(
            message=f"Conversation '{conv_id}' not found or access denied.",
            status_code=404,
            error_code="CONVERSATION_NOT_FOUND",
            details={"conversation_id": conv_id},
        )


class ConversationManager:
    """Manages CRUD for conversations, messages, and citations with strict tenant isolation."""

    async def create_conversation(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str = "New Conversation",
        active_document_ids: Optional[List[str]] = None,
    ) -> Conversation:
        """Create a new conversation thread within the workspace."""
        clean_title = (title or "New Conversation").strip()[:255]
        doc_ids = [str(d) for d in (active_document_ids or [])]

        conv = Conversation(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            user_id=user_id,
            title=clean_title,
            active_document_ids=doc_ids,
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        return conv

    async def list_conversations(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        limit: int = 30,
        offset: int = 0,
    ) -> List[Conversation]:
        """List conversation threads in workspace ordered by most recent activity."""
        stmt = (
            select(Conversation)
            .where(Conversation.workspace_id == workspace_id)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .offset(offset)
        )
        if user_id:
            stmt = stmt.where(Conversation.user_id == user_id)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_conversation(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        conversation_id: uuid.UUID,
    ) -> Optional[Conversation]:
        """Retrieve conversation by ID enforcing workspace ownership."""
        stmt = (
            select(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == workspace_id,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_conversation(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        conversation_id: uuid.UUID,
        title: Optional[str] = None,
        active_document_ids: Optional[List[str]] = None,
    ) -> Optional[Conversation]:
        """Update conversation title or active document scope."""
        conv = await self.get_conversation(db, workspace_id, conversation_id)
        if not conv:
            return None

        if title is not None:
            conv.title = title.strip()[:255]
        if active_document_ids is not None:
            conv.active_document_ids = [str(d) for d in active_document_ids]

        await db.commit()
        await db.refresh(conv)
        return conv

    async def delete_conversation(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        conversation_id: uuid.UUID,
    ) -> bool:
        """Delete conversation and cascade messages/citations, preserving source documents."""
        conv = await self.get_conversation(db, workspace_id, conversation_id)
        if not conv:
            return False

        await db.delete(conv)
        await db.commit()
        return True

    async def get_messages(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        conversation_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Message]:
        """Fetch messages and associated citations for a conversation thread."""
        conv = await self.get_conversation(db, workspace_id, conversation_id)
        if not conv:
            raise ConversationNotFoundError(str(conversation_id))

        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.citations).selectinload(Citation.document))
            .order_by(Message.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def persist_user_message(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        content: str,
    ) -> Message:
        """Store user inquiry turn in the database."""
        msg = Message(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            sender_type="user",
            content=content.strip(),
            token_count=estimate_token_count(content),
        )
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg

    async def persist_assistant_message(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        content: str,
        citations: List[CitationDTO],
    ) -> Message:
        """Store assistant response and link validated citations."""
        msg_id = uuid.uuid4()
        msg = Message(
            id=msg_id,
            conversation_id=conversation_id,
            sender_type="assistant",
            content=content.strip(),
            token_count=estimate_token_count(content),
        )
        db.add(msg)
        await db.flush()

        # Persist associated citations
        created_citations = []
        for cite_dto in citations:
            try:
                c_model = Citation(
                    id=uuid.uuid4(),
                    message_id=msg_id,
                    chunk_id=uuid.UUID(cite_dto.chunk_id),
                    document_id=uuid.UUID(cite_dto.document_id),
                    page_number=cite_dto.page_number,
                    quote=cite_dto.quote,
                    relevance_score=cite_dto.relevance_score,
                )
                db.add(c_model)
                cite_dto.id = str(c_model.id)
                created_citations.append(c_model)
            except Exception as e:
                logger.error("Failed to persist citation for chunk %s: %s", cite_dto.chunk_id, e)

        await db.commit()
        await db.refresh(msg)
        return msg
