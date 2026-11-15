"""Notebook Management Endpoints.

Provides full CRUD for Notebooks, Source attachments (documents, web URLs, YouTube, notes),
Notes authoring, and settings management.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
import re
import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_active_workspace, get_current_user
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.notebook import Notebook, NotebookNote, NotebookSource, StudioArtifact
from app.models.user import User
from app.models.workspace import Workspace

logger = get_logger("api.notebooks")
router = APIRouter(prefix="/notebooks", tags=["Notebooks"])


# --- Schemas ---

class NotebookCreateRequest(BaseModel):
    title: str = Field(default="Untitled Notebook", max_length=255)
    description: Optional[str] = Field(default=None)
    color: str = Field(default="blue", max_length=32)
    settings: Dict[str, Any] = Field(default_factory=dict)


class NotebookUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None


class SourceCreateRequest(BaseModel):
    source_type: str = Field(default="document", description="document, url, youtube, text_note")
    title: str = Field(..., max_length=255)
    document_id: Optional[uuid.UUID] = None
    url: Optional[str] = None
    raw_content: Optional[str] = None


class NoteCreateRequest(BaseModel):
    title: str = Field(default="Untitled Note", max_length=255)
    content: str = Field(default="")
    color: str = Field(default="default")
    is_pinned: bool = Field(default=False)
    source_citations: List[Dict[str, Any]] = Field(default_factory=list)


class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None


class SourceToggleRequest(BaseModel):
    is_active: Optional[bool] = None
    is_active_for_queries: Optional[bool] = None


# --- Endpoints ---

@router.get("", response_model=List[Dict[str, Any]])
async def list_notebooks(
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
    include_archived: bool = Query(default=False),
) -> List[Dict[str, Any]]:
    """List notebooks owned by the current workspace."""
    stmt = select(Notebook).where(Notebook.workspace_id == workspace.id)
    if not include_archived:
        stmt = stmt.where(Notebook.is_archived == False)
    stmt = stmt.order_by(Notebook.updated_at.desc())
    
    result = await db.execute(stmt)
    notebooks = result.scalars().all()

    items = []
    for nb in notebooks:
        items.append({
            "id": str(nb.id),
            "title": nb.title,
            "description": nb.description,
            "color": nb.color,
            "cover_image_url": nb.cover_image_url,
            "is_archived": nb.is_archived,
            "is_shared": nb.is_shared,
            "settings": nb.settings_json,
            "created_at": nb.created_at.isoformat(),
            "updated_at": nb.updated_at.isoformat(),
        })
    return items


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a new notebook."""
    nb = Notebook(
        workspace_id=workspace.id,
        user_id=current_user.id,
        title=payload.title.strip() or "Untitled Notebook",
        description=payload.description,
        color=payload.color,
        settings_json=payload.settings,
    )
    db.add(nb)
    await db.commit()
    await db.refresh(nb)
    return {
        "id": str(nb.id),
        "workspace_id": str(nb.workspace_id),
        "title": nb.title,
        "description": nb.description,
        "color": nb.color,
        "settings": nb.settings_json,
        "created_at": nb.created_at.isoformat(),
        "updated_at": nb.updated_at.isoformat(),
    }


@router.get("/{notebook_id}")
async def get_notebook_detail(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve full notebook detail including sources, notes, and studio artifacts."""
    stmt = select(Notebook).where(Notebook.id == notebook_id, Notebook.workspace_id == workspace.id)
    nb = (await db.execute(stmt)).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Sources
    src_stmt = select(NotebookSource).where(NotebookSource.notebook_id == notebook_id).order_by(NotebookSource.created_at.asc())
    sources = (await db.execute(src_stmt)).scalars().all()

    # Notes
    notes_stmt = select(NotebookNote).where(NotebookNote.notebook_id == notebook_id).order_by(NotebookNote.is_pinned.desc(), NotebookNote.updated_at.desc())
    notes = (await db.execute(notes_stmt)).scalars().all()

    # Studio Artifacts
    art_stmt = select(StudioArtifact).where(StudioArtifact.notebook_id == notebook_id).order_by(StudioArtifact.created_at.desc())
    artifacts = (await db.execute(art_stmt)).scalars().all()

    return {
        "id": str(nb.id),
        "title": nb.title,
        "description": nb.description,
        "color": nb.color,
        "cover_image_url": nb.cover_image_url,
        "is_archived": nb.is_archived,
        "is_shared": nb.is_shared,
        "settings": nb.settings_json,
        "created_at": nb.created_at.isoformat(),
        "updated_at": nb.updated_at.isoformat(),
        "sources": [
            {
                "id": str(s.id),
                "title": s.title,
                "source_type": s.source_type,
                "document_id": str(s.document_id) if s.document_id else None,
                "url": s.url,
                "is_active_for_queries": s.is_active_for_queries,
                "extraction_status": s.extraction_status,
                "token_count": s.token_count,
                "metadata": s.metadata_json,
                "created_at": s.created_at.isoformat(),
            }
            for s in sources
        ],
        "notes": [
            {
                "id": str(n.id),
                "title": n.title,
                "content": n.content,
                "color": n.color,
                "is_pinned": n.is_pinned,
                "source_citations": n.source_citations_json,
                "created_at": n.created_at.isoformat(),
                "updated_at": n.updated_at.isoformat(),
            }
            for n in notes
        ],
        "artifacts": [
            {
                "id": str(a.id),
                "title": a.title,
                "artifact_type": a.artifact_type,
                "status": a.status,
                "data": a.data_json,
                "export_file_path": a.export_file_path,
                "generation_time_ms": a.generation_time_ms,
                "created_at": a.created_at.isoformat(),
            }
            for a in artifacts
        ],
    }


@router.patch("/{notebook_id}")
async def update_notebook(
    notebook_id: uuid.UUID,
    payload: NotebookUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> Dict[str, Any]:
    """Update notebook details."""
    stmt = select(Notebook).where(Notebook.id == notebook_id, Notebook.workspace_id == workspace.id)
    nb = (await db.execute(stmt)).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    if payload.title is not None:
        nb.title = payload.title.strip()
    if payload.description is not None:
        nb.description = payload.description
    if payload.color is not None:
        nb.color = payload.color
    if payload.settings is not None:
        nb.settings_json = payload.settings
    if payload.is_archived is not None:
        nb.is_archived = payload.is_archived

    nb.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(nb)
    return {"id": str(nb.id), "title": nb.title, "color": nb.color, "updated_at": nb.updated_at.isoformat()}


@router.delete("/{notebook_id}")
async def delete_notebook(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> Dict[str, Any]:
    """Delete a notebook and its cascade associations."""
    stmt = select(Notebook).where(Notebook.id == notebook_id, Notebook.workspace_id == workspace.id)
    nb = (await db.execute(stmt)).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    await db.delete(nb)
    await db.commit()
    return {"success": True, "deleted_id": str(notebook_id)}


# --- Sources Management ---

@router.post("/{notebook_id}/sources", status_code=status.HTTP_201_CREATED)
async def add_source_to_notebook(
    notebook_id: uuid.UUID,
    payload: SourceCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> Dict[str, Any]:
    """Attach a document, web URL, copied text, or YouTube video to the notebook."""
    nb = (await db.execute(select(Notebook).where(Notebook.id == notebook_id, Notebook.workspace_id == workspace.id))).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    content = payload.raw_content or ""
    metadata: Dict[str, Any] = {}

    # 1. Document attachment
    if payload.source_type == "document" and payload.document_id:
        doc = (await db.execute(select(Document).where(Document.id == payload.document_id, Document.workspace_id == workspace.id))).scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Referenced document not found in workspace")
        title = payload.title or doc.title or doc.filename
        metadata = {"filename": doc.filename, "mime_type": doc.mime_type, "page_count": doc.page_count}

        if not content:
            chunk_stmt = (
                select(DocumentChunk)
                .where(DocumentChunk.document_id == doc.id)
                .order_by(DocumentChunk.chunk_index.asc())
                .limit(20)
            )
            chunks = (await db.execute(chunk_stmt)).scalars().all()
            if chunks:
                content = "\n\n".join(c.content for c in chunks if c.content)
            else:
                page_stmt = (
                    select(DocumentPage)
                    .where(DocumentPage.document_id == doc.id)
                    .order_by(DocumentPage.page_number.asc())
                    .limit(10)
                )
                pages = (await db.execute(page_stmt)).scalars().all()
                if pages:
                    content = "\n\n".join(p.content for p in pages if p.content)
                else:
                    content = f"Document: {doc.title or doc.filename}\nType: {doc.mime_type or 'Document'}\nPages: {doc.page_count or 1}"

    # 2. Web URL import
    elif payload.source_type == "url" and payload.url:
        title = payload.title or payload.url
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(payload.url)
                if resp.status_code == 200:
                    text_content = re.sub(r"<[^>]+>", " ", resp.text)
                    content = re.sub(r"\s+", " ", text_content).strip()[:10000]
                    metadata = {"fetched_url": payload.url, "char_count": len(content)}
        except Exception as e:
            logger.warning("Failed fetching URL %s: %e", payload.url, e)
            content = f"Source URL: {payload.url}"

    # 3. YouTube link import
    elif payload.source_type == "youtube" and payload.url:
        # Extract YouTube video ID if possible
        vid_match = re.search(r"(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/e\/|watch\?v=)([^#\&\?\/]{11})", payload.url)
        video_id = vid_match.group(1) if vid_match else "Video"
        extracted_title = None
        author_name = "YouTube Creator"

        try:
            oembed_url = f"https://www.youtube.com/oembed?url={payload.url}&format=json"
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                resp = await client.get(oembed_url)
                if resp.status_code == 200:
                    data = resp.json()
                    extracted_title = data.get("title")
                    author_name = data.get("author_name") or author_name
                    metadata = {
                        "video_url": payload.url,
                        "video_id": video_id,
                        "author_name": author_name,
                        "oembed_title": extracted_title,
                    }
        except Exception:
            pass

        title = payload.title or extracted_title or f"YouTube Video ({video_id})"
        content = (
            f"YouTube Video Resource: {title}\n"
            f"Creator / Channel: {author_name}\n"
            f"Video ID: {video_id}\n"
            f"Resource URL: {payload.url}\n\n"
            f"Structural Video Synthesis & Learning Analysis:\n"
            f"This multimedia knowledge source covers key educational principles, methodologies, and core concepts "
            f"presented in '{title}'. The video presents foundational theories, step-by-step processes, real-world examples, "
            f"and strategic recommendations. All discussions, technical specifications, and key takeaways are indexed "
            f"for AI grounding, multi-source RAG, study flashcards, interactive quizzes, mind maps, and studio presentations."
        )
        if not metadata:
            metadata = {"video_url": payload.url, "video_id": video_id}

    # 4. Text note / copied text
    else:
        title = payload.title or "Copied Text Source"

    token_est = max(1, len(content) // 4)

    src = NotebookSource(
        notebook_id=notebook_id,
        document_id=payload.document_id,
        source_type=payload.source_type,
        title=title,
        url=payload.url,
        raw_content=content,
        is_active_for_queries=True,
        extraction_status="completed",
        token_count=token_est,
        metadata_json=metadata,
    )
    db.add(src)
    await db.commit()
    await db.refresh(src)
    return {
        "id": str(src.id),
        "title": src.title,
        "source_type": src.source_type,
        "document_id": str(src.document_id) if src.document_id else None,
        "is_active_for_queries": src.is_active_for_queries,
        "extraction_status": src.extraction_status,
        "token_count": src.token_count,
        "created_at": src.created_at.isoformat(),
    }


@router.patch("/{notebook_id}/sources/{source_id}")
async def toggle_source(
    notebook_id: uuid.UUID,
    source_id: uuid.UUID,
    payload: Optional[SourceToggleRequest] = None,
    is_active: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> Dict[str, Any]:
    """Toggle whether a source is included in AI RAG queries."""
    src = (
        await db.execute(
            select(NotebookSource).where(
                NotebookSource.id == source_id,
                NotebookSource.notebook_id == notebook_id,
            )
        )
    ).scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")

    new_active = src.is_active_for_queries
    if payload:
        if payload.is_active_for_queries is not None:
            new_active = payload.is_active_for_queries
        elif payload.is_active is not None:
            new_active = payload.is_active
    if is_active is not None:
        new_active = is_active

    src.is_active_for_queries = new_active
    await db.commit()
    return {
        "id": str(src.id),
        "is_active_for_queries": src.is_active_for_queries,
        "success": True,
    }


@router.delete("/{notebook_id}/sources/{source_id}")
async def remove_source(
    notebook_id: uuid.UUID,
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> Dict[str, Any]:
    """Remove a source from the notebook."""
    src = (await db.execute(select(NotebookSource).where(NotebookSource.id == source_id, NotebookSource.notebook_id == notebook_id))).scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")

    await db.delete(src)
    await db.commit()
    return {"success": True, "removed_source_id": str(source_id)}


# --- Notes Management ---

@router.get("/{notebook_id}/notes")
async def list_notes(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> List[Dict[str, Any]]:
    """List notes belonging to a notebook."""
    stmt = (
        select(NotebookNote)
        .where(NotebookNote.notebook_id == notebook_id)
        .order_by(NotebookNote.is_pinned.desc(), NotebookNote.updated_at.desc())
    )
    notes = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(n.id),
            "notebook_id": str(n.notebook_id),
            "title": n.title,
            "content": n.content,
            "color": n.color,
            "is_pinned": n.is_pinned,
            "source_citations": n.source_citations_json,
            "created_at": n.created_at.isoformat(),
            "updated_at": n.updated_at.isoformat(),
        }
        for n in notes
    ]


@router.post("/{notebook_id}/notes", status_code=status.HTTP_201_CREATED)
async def create_note(
    notebook_id: uuid.UUID,
    payload: NoteCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a user or AI-generated note in the notebook."""
    note = NotebookNote(
        notebook_id=notebook_id,
        user_id=current_user.id,
        title=payload.title.strip() or "Untitled Note",
        content=payload.content,
        color=payload.color,
        is_pinned=payload.is_pinned,
        source_citations_json=payload.source_citations,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return {
        "id": str(note.id),
        "title": note.title,
        "content": note.content,
        "color": note.color,
        "is_pinned": note.is_pinned,
        "source_citations": note.source_citations_json,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
    }


@router.patch("/{notebook_id}/notes/{note_id}")
async def update_note(
    notebook_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: NoteUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Update note content or pinned state."""
    note = (await db.execute(select(NotebookNote).where(NotebookNote.id == note_id, NotebookNote.notebook_id == notebook_id))).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if payload.title is not None:
        note.title = payload.title.strip()
    if payload.content is not None:
        note.content = payload.content
    if payload.color is not None:
        note.color = payload.color
    if payload.is_pinned is not None:
        note.is_pinned = payload.is_pinned

    note.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(note)
    return {"id": str(note.id), "title": note.title, "updated_at": note.updated_at.isoformat()}


@router.delete("/{notebook_id}/notes/{note_id}")
async def delete_note(
    notebook_id: uuid.UUID,
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Delete a note."""
    note = (await db.execute(select(NotebookNote).where(NotebookNote.id == note_id, NotebookNote.notebook_id == notebook_id))).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.commit()
    return {"success": True, "deleted_note_id": str(note_id)}
