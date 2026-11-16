"""Chat, Conversations, Grounded Q&A, and Citation API Endpoints.

Provides conversation lifecycle management, message history with verified citations,
and synchronous or SSE streaming grounded answers.
"""

from datetime import datetime
import json
from typing import Any, Dict, List, Literal, Optional
import uuid
from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace, get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.exceptions import UDIPException
from app.core.logging import get_logger
from app.core.rate_limit import RateLimitDependency
from app.models.chat import Conversation
from app.models.notebook import NotebookSource
from app.models.user import User
from app.models.workspace import Workspace
from app.services.rag.conversation_manager import ConversationManager, ConversationNotFoundError
from app.services.rag.models import CitationDTO, RAGRequest, RAGResponse
from app.services.rag.service import RAGService

logger = get_logger("api.chat")

router = APIRouter(prefix="/chat", tags=["Chat & Conversations"])


# --- Schemas ---

class CreateConversationRequest(BaseModel):
    title: Optional[str] = Field(default="New Conversation", max_length=255)
    active_document_ids: Optional[List[str]] = Field(default_factory=list)


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    active_document_ids: Optional[List[str]] = None


class CitationResponse(BaseModel):
    id: str
    document_id: str
    document_filename: str
    chunk_id: str
    page_number: int
    quote: str
    relevance_score: Optional[float] = None
    created_at: datetime


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_type: str
    content: str
    token_count: int
    created_at: datetime
    citations: List[CitationResponse] = Field(default_factory=list)


class ConversationResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    active_document_ids: List[str]
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = Field(default_factory=list)


class SendMessageRequest(BaseModel):
    question: Optional[str] = Field(default=None, max_length=2000, description="User question")
    content: Optional[str] = Field(default=None, max_length=2000, description="Alternative field for user question")
    selected_document_ids: Optional[List[uuid.UUID]] = Field(
        default=None,
        description="Optional filter restricting search to specific document UUIDs",
    )
    retrieval_mode: Literal["hybrid", "vector", "keyword"] = Field(
        default="hybrid",
        description="Search algorithm mode",
    )
    stream: bool = Field(default=False, description="Whether to stream response tokens via SSE")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=4096)
    options: Optional[Dict[str, Any]] = Field(default=None, description="Optional extra execution options")

    @model_validator(mode="before")
    @classmethod
    def resolve_question_field(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("question") and data.get("content"):
                data["question"] = data["content"]
            if not data.get("question"):
                raise ValueError("Either 'question' or 'content' must be provided and non-empty.")
        return data


# --- Endpoints ---

@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ConversationResponse:
    """Create a new conversation thread within the active workspace."""
    manager = ConversationManager()
    conv = await manager.create_conversation(
        db=db,
        workspace_id=workspace.id,
        user_id=current_user.id,
        title=request.title or "New Conversation",
        active_document_ids=request.active_document_ids,
    )
    return ConversationResponse(
        id=str(conv.id),
        workspace_id=str(conv.workspace_id),
        user_id=str(conv.user_id),
        title=conv.title,
        active_document_ids=conv.active_document_ids or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get("/conversations", response_model=List[ConversationResponse], status_code=status.HTTP_200_OK)
async def list_conversations(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> List[ConversationResponse]:
    """List conversation threads in the active workspace."""
    manager = ConversationManager()
    convs = await manager.list_conversations(
        db=db,
        workspace_id=workspace.id,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return [
        ConversationResponse(
            id=str(c.id),
            workspace_id=str(c.workspace_id),
            user_id=str(c.user_id),
            title=c.title,
            active_document_ids=c.active_document_ids or [],
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in convs
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse, status_code=status.HTTP_200_OK)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ConversationDetailResponse:
    """Retrieve conversation details and historical message history with citations."""
    manager = ConversationManager()
    conv = await manager.get_conversation(db, workspace.id, conversation_id)
    if not conv:
        raise ConversationNotFoundError(str(conversation_id))

    messages = await manager.get_messages(db, workspace.id, conversation_id)
    msg_responses = []
    for m in messages:
        cites = [
            CitationResponse(
                id=str(cite.id),
                document_id=str(cite.document_id),
                document_filename=cite.document.filename if cite.document else "Unknown",
                chunk_id=str(cite.chunk_id),
                page_number=cite.page_number,
                quote=cite.quote,
                relevance_score=cite.relevance_score,
                created_at=cite.created_at,
            )
            for cite in m.citations
        ]
        msg_responses.append(
            MessageResponse(
                id=str(m.id),
                conversation_id=str(m.conversation_id),
                sender_type=m.sender_type,
                content=m.content,
                token_count=m.token_count,
                created_at=m.created_at,
                citations=cites,
            )
        )

    return ConversationDetailResponse(
        id=str(conv.id),
        workspace_id=str(conv.workspace_id),
        user_id=str(conv.user_id),
        title=conv.title,
        active_document_ids=conv.active_document_ids or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=msg_responses,
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse, status_code=status.HTTP_200_OK)
async def update_conversation(
    conversation_id: uuid.UUID,
    request: UpdateConversationRequest,
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> ConversationResponse:
    """Update conversation title or active document scope."""
    manager = ConversationManager()
    conv = await manager.update_conversation(
        db=db,
        workspace_id=workspace.id,
        conversation_id=conversation_id,
        title=request.title,
        active_document_ids=request.active_document_ids,
    )
    if not conv:
        raise ConversationNotFoundError(str(conversation_id))

    return ConversationResponse(
        id=str(conv.id),
        workspace_id=str(conv.workspace_id),
        user_id=str(conv.user_id),
        title=conv.title,
        active_document_ids=conv.active_document_ids or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, str]:
    """Delete a conversation and cascade all its messages/citations."""
    manager = ConversationManager()
    deleted = await manager.delete_conversation(db, workspace.id, conversation_id)
    if not deleted:
        raise ConversationNotFoundError(str(conversation_id))
    return {"message": "Conversation deleted successfully"}


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse], status_code=status.HTTP_200_OK)
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> List[MessageResponse]:
    """List historical messages and verified citations for a conversation."""
    manager = ConversationManager()
    messages = await manager.get_messages(
        db=db,
        workspace_id=workspace.id,
        conversation_id=conversation_id,
        limit=limit,
        offset=offset,
    )

    msg_responses = []
    for m in messages:
        cites = [
            CitationResponse(
                id=str(cite.id),
                document_id=str(cite.document_id),
                document_filename=cite.document.filename if cite.document else "Unknown",
                chunk_id=str(cite.chunk_id),
                page_number=cite.page_number,
                quote=cite.quote,
                relevance_score=cite.relevance_score,
                created_at=cite.created_at,
            )
            for cite in m.citations
        ]
        msg_responses.append(
            MessageResponse(
                id=str(m.id),
                conversation_id=str(m.conversation_id),
                sender_type=m.sender_type,
                content=m.content,
                token_count=m.token_count,
                created_at=m.created_at,
                citations=cites,
            )
        )
    return msg_responses


chat_rate_limiter = RateLimitDependency(calls_per_minute=40, scope="chat_inference")


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    request: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    _rl: None = Depends(chat_rate_limiter),
):
    """Post a user inquiry and receive a grounded assistant answer with citations."""
    # Resolve any notebook source IDs to their underlying document UUIDs
    resolved_doc_ids = []
    if request.selected_document_ids:
        for did in request.selected_document_ids:
            src_doc_id = (
                await db.execute(select(NotebookSource.document_id).where(NotebookSource.id == did))
            ).scalar_one_or_none()
            if src_doc_id:
                resolved_doc_ids.append(src_doc_id)
            else:
                resolved_doc_ids.append(did)

    target_workspace_id = workspace.id
    conv_check = (await db.execute(select(Conversation.workspace_id).where(Conversation.id == conversation_id))).scalar_one_or_none()
    if conv_check:
        target_workspace_id = conv_check

    rag_service = RAGService(settings=settings, custom_api_key=x_gemini_api_key)
    rag_request = RAGRequest(
        question=request.question,
        conversation_id=conversation_id,
        selected_document_ids=resolved_doc_ids if resolved_doc_ids else None,
        retrieval_mode=request.retrieval_mode,
        stream=request.stream,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )

    if request.stream:
        # Stream response tokens via Server-Sent Events (SSE)
        async def event_generator():
            async for event_dict in rag_service.answer_question_stream(
                db=db,
                workspace_id=target_workspace_id,
                user_id=current_user.id,
                request=rag_request,
            ):
                event_type = event_dict.get("event", "message")
                data_obj = dict(event_dict.get("data", {}))
                # Ensure dual-schema compatibility for frontends expecting token vs text vs type
                if event_type == "token":
                    tok = data_obj.get("token", "")
                    data_obj["text"] = tok
                    data_obj["type"] = "chunk"
                elif event_type == "citations":
                    data_obj["type"] = "complete"
                payload = json.dumps(data_obj)
                yield f"event: {event_type}\ndata: {payload}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Standard non-streaming JSON response
    response: RAGResponse = await rag_service.answer_question(
        db=db,
        workspace_id=target_workspace_id,
        user_id=current_user.id,
        request=rag_request,
    )
    return response
