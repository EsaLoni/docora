"""Folder Management API Endpoints.

Provides hierarchical folder creation, renaming, moving, and deletion
with circular hierarchy prevention and workspace tenant enforcement.
"""

from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_workspace
from app.core.database import get_db_session
from app.core.exceptions import ResourceNotFoundError, UDIPException
from app.core.logging import get_logger
from app.models.document import Document
from app.models.workspace import Folder, Workspace

logger = get_logger("api.folders")

router = APIRouter(prefix="/folders", tags=["Folders"])


class FolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    parent_id: Optional[uuid.UUID] = None
    color: Optional[str] = Field(default="#4F46E5", max_length=7)


class FolderUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    parent_id: Optional[uuid.UUID] = None
    clear_parent: Optional[bool] = False
    color: Optional[str] = Field(default=None, max_length=7)


class FolderResponse(BaseModel):
    id: str
    workspace_id: str
    parent_id: Optional[str]
    name: str
    color: Optional[str]
    document_count: int = 0
    created_at: str


async def _check_circular_hierarchy(
    db: AsyncSession,
    folder_id: uuid.UUID,
    target_parent_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> None:
    """Verify that target_parent_id is not folder_id or any of its descendants."""
    if folder_id == target_parent_id:
        raise UDIPException(
            message="Circular hierarchy detected: A folder cannot be its own parent.",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="CIRCULAR_FOLDER_HIERARCHY",
        )

    # Traverse upwards from target_parent_id to ensure it never reaches folder_id
    current_parent_id: Optional[uuid.UUID] = target_parent_id
    visited = set()

    while current_parent_id is not None:
        if current_parent_id == folder_id:
            raise UDIPException(
                message="Circular hierarchy detected: Cannot move a folder inside one of its descendants.",
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="CIRCULAR_FOLDER_HIERARCHY",
            )
        if current_parent_id in visited:
            break
        visited.add(current_parent_id)

        stmt = select(Folder.parent_id).where(
            Folder.id == current_parent_id,
            Folder.workspace_id == workspace_id,
        )
        result = await db.execute(stmt)
        current_parent_id = result.scalar_one_or_none()


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    request: FolderCreateRequest,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> FolderResponse:
    """Create a new folder within the active workspace."""
    # 1. Validate parent if specified
    if request.parent_id:
        parent_stmt = select(Folder).where(
            Folder.id == request.parent_id,
            Folder.workspace_id == workspace.id,
        )
        parent = (await db.execute(parent_stmt)).scalar_one_or_none()
        if not parent:
            raise ResourceNotFoundError("Parent Folder", str(request.parent_id))

    # 2. Check duplicate name under same parent
    dup_stmt = select(Folder).where(
        Folder.workspace_id == workspace.id,
        Folder.parent_id == request.parent_id,
        Folder.name == request.name,
    )
    dup = (await db.execute(dup_stmt)).scalar_one_or_none()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A folder named '{request.name}' already exists in this directory.",
        )

    folder = Folder(
        workspace_id=workspace.id,
        parent_id=request.parent_id,
        name=request.name.strip(),
        color=request.color or "#4F46E5",
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)

    return FolderResponse(
        id=str(folder.id),
        workspace_id=str(folder.workspace_id),
        parent_id=str(folder.parent_id) if folder.parent_id else None,
        name=folder.name,
        color=folder.color,
        document_count=0,
        created_at=folder.created_at.isoformat(),
    )


@router.get("", response_model=List[FolderResponse])
async def list_folders(
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> List[FolderResponse]:
    """List all folders in the active workspace with document counts."""
    # Subquery for document counts
    doc_count_sub = (
        select(Document.folder_id, func.count(Document.id).label("doc_count"))
        .where(Document.workspace_id == workspace.id, Document.is_deleted == False)
        .group_by(Document.folder_id)
        .subquery()
    )

    stmt = (
        select(Folder, func.coalesce(doc_count_sub.c.doc_count, 0))
        .outerjoin(doc_count_sub, Folder.id == doc_count_sub.c.folder_id)
        .where(Folder.workspace_id == workspace.id)
        .order_by(Folder.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        FolderResponse(
            id=str(f.id),
            workspace_id=str(f.workspace_id),
            parent_id=str(f.parent_id) if f.parent_id else None,
            name=f.name,
            color=f.color,
            document_count=count,
            created_at=f.created_at.isoformat(),
        )
        for f, count in rows
    ]


@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    request: FolderUpdateRequest,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> FolderResponse:
    """Rename or move a folder, preventing circular hierarchies."""
    stmt = select(Folder).where(
        Folder.id == folder_id,
        Folder.workspace_id == workspace.id,
    )
    folder = (await db.execute(stmt)).scalar_one_or_none()
    if not folder:
        raise ResourceNotFoundError("Folder", str(folder_id))

    # Move parent logic
    if request.clear_parent:
        folder.parent_id = None
    elif request.parent_id is not None:
        # Check target parent exists in active workspace
        target_stmt = select(Folder).where(
            Folder.id == request.parent_id,
            Folder.workspace_id == workspace.id,
        )
        target_parent = (await db.execute(target_stmt)).scalar_one_or_none()
        if not target_parent:
            raise ResourceNotFoundError("Parent Folder", str(request.parent_id))

        # Check circular hierarchy
        await _check_circular_hierarchy(db, folder.id, request.parent_id, workspace.id)
        folder.parent_id = request.parent_id

    if request.name is not None:
        folder.name = request.name.strip()
    if request.color is not None:
        folder.color = request.color

    await db.commit()
    await db.refresh(folder)

    # Count docs
    cnt_stmt = select(func.count(Document.id)).where(
        Document.folder_id == folder.id,
        Document.is_deleted == False,
    )
    doc_count = (await db.execute(cnt_stmt)).scalar_one()

    return FolderResponse(
        id=str(folder.id),
        workspace_id=str(folder.workspace_id),
        parent_id=str(folder.parent_id) if folder.parent_id else None,
        name=folder.name,
        color=folder.color,
        document_count=doc_count,
        created_at=folder.created_at.isoformat(),
    )


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: uuid.UUID,
    workspace: Workspace = Depends(get_active_workspace),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a folder. Child documents have folder_id set to null; nested folders cascade."""
    stmt = select(Folder).where(
        Folder.id == folder_id,
        Folder.workspace_id == workspace.id,
    )
    folder = (await db.execute(stmt)).scalar_one_or_none()
    if not folder:
        raise ResourceNotFoundError("Folder", str(folder_id))

    await db.delete(folder)
    await db.commit()
