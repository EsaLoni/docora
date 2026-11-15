"""Workspace & Multi-Tenant Resource Endpoints.

Enforces strict tenant isolation across workspaces, documents, conversations,
and processing jobs.
"""

from typing import Any, Dict, List
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_active_workspace,
    get_conversation_for_workspace,
    get_current_user,
    get_document_for_workspace,
    get_processing_job_for_workspace,
)
from app.core.database import get_db_session
from app.models.chat import Conversation
from app.models.document import Document
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


class WorkspaceItem(BaseModel):
    id: str
    name: str
    slug: str
    owner_id: str
    role: str


class DocumentItem(BaseModel):
    id: str
    workspace_id: str
    title: str
    filename: str
    status: str
    page_count: int


class ConversationItem(BaseModel):
    id: str
    workspace_id: str
    title: str


class ProcessingJobItem(BaseModel):
    id: str
    workspace_id: str
    document_id: str
    status: str
    progress_percentage: int


@router.get("", response_model=List[WorkspaceItem])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[WorkspaceItem]:
    """List all workspaces the authenticated user belongs to."""
    stmt = (
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        WorkspaceItem(
            id=str(ws.id),
            name=ws.name,
            slug=ws.slug,
            owner_id=str(ws.owner_id),
            role=role,
        )
        for ws, role in rows
    ]


@router.get("/{workspace_id}", response_model=WorkspaceItem)
async def get_workspace_details(
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> WorkspaceItem:
    """Get details for an authorized workspace. Cross-tenant access is rejected with 403."""
    stmt = select(WorkspaceMember.role).where(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    role = result.scalar_one_or_none() or "member"

    return WorkspaceItem(
        id=str(workspace.id),
        name=workspace.name,
        slug=workspace.slug,
        owner_id=str(workspace.owner_id),
        role=role,
    )


@router.get("/{workspace_id}/documents", response_model=List[DocumentItem])
async def list_workspace_documents(
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> List[DocumentItem]:
    """List documents belonging exclusively to the active workspace."""
    stmt = (
        select(Document)
        .where(
            Document.workspace_id == workspace.id,
            Document.is_deleted == False,
        )
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(stmt)
    docs = result.scalars().all()

    return [
        DocumentItem(
            id=str(d.id),
            workspace_id=str(d.workspace_id),
            title=d.title,
            filename=d.filename,
            status=d.status,
            page_count=d.page_count,
        )
        for d in docs
    ]


@router.get("/{workspace_id}/documents/{document_id}", response_model=DocumentItem)
async def get_workspace_document(
    document: Document = Depends(get_document_for_workspace),
) -> DocumentItem:
    """Retrieve document details ensuring strict workspace tenancy."""
    return DocumentItem(
        id=str(document.id),
        workspace_id=str(document.workspace_id),
        title=document.title,
        filename=document.filename,
        status=document.status,
        page_count=document.page_count,
    )


@router.get("/{workspace_id}/conversations", response_model=List[ConversationItem])
async def list_workspace_conversations(
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> List[ConversationItem]:
    """List conversations belonging exclusively to the active workspace."""
    stmt = (
        select(Conversation)
        .where(Conversation.workspace_id == workspace.id)
        .order_by(Conversation.created_at.desc())
    )
    result = await db.execute(stmt)
    convs = result.scalars().all()

    return [
        ConversationItem(
            id=str(c.id),
            workspace_id=str(c.workspace_id),
            title=c.title,
        )
        for c in convs
    ]


@router.get("/{workspace_id}/conversations/{conversation_id}", response_model=ConversationItem)
async def get_workspace_conversation(
    conversation: Conversation = Depends(get_conversation_for_workspace),
) -> ConversationItem:
    """Retrieve conversation details ensuring strict workspace tenancy."""
    return ConversationItem(
        id=str(conversation.id),
        workspace_id=str(conversation.workspace_id),
        title=conversation.title,
    )


@router.get("/{workspace_id}/jobs", response_model=List[ProcessingJobItem])
async def list_workspace_jobs(
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> List[ProcessingJobItem]:
    """List processing jobs belonging exclusively to the active workspace."""
    stmt = (
        select(ProcessingJob)
        .where(ProcessingJob.workspace_id == workspace.id)
        .order_by(ProcessingJob.created_at.desc())
    )
    result = await db.execute(stmt)
    jobs = result.scalars().all()

    return [
        ProcessingJobItem(
            id=str(j.id),
            workspace_id=str(j.workspace_id),
            document_id=str(j.document_id),
            status=j.status,
            progress_percentage=j.progress_percentage,
        )
        for j in jobs
    ]


@router.get("/{workspace_id}/jobs/{job_id}", response_model=ProcessingJobItem)
async def get_workspace_job(
    job: ProcessingJob = Depends(get_processing_job_for_workspace),
) -> ProcessingJobItem:
    """Retrieve processing job details ensuring strict workspace tenancy."""
    return ProcessingJobItem(
        id=str(job.id),
        workspace_id=str(job.workspace_id),
        document_id=str(job.document_id),
        status=job.status,
        progress_percentage=job.progress_percentage,
    )
