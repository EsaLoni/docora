"""Studio Tools Generation Endpoints.

Dispatches execution for all 9 Studio tools: Audio Overview, Presentation Slide Deck,
Structured Reports, Flashcards, Quizzes, Mind Maps, Data Tables, Infographics, and Video Storyboards.
"""

import os
from typing import Any, Dict, List, Optional
import urllib.parse
import uuid
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_active_workspace, get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.services.storage import get_storage_adapter
from app.models.document import DocumentChunk
from app.models.notebook import (
    AudioGeneration,
    DataTable,
    FlashcardDeck,
    Infographic,
    MindMap,
    Notebook,
    NotebookSource,
    Presentation,
    Quiz,
    Report,
    StudioArtifact,
    VideoGeneration,
)
from app.models.user import User
from app.models.workspace import Workspace
from app.services.studio.audio_service import AudioOverviewService
from app.services.studio.datatable_service import DataTableService
from app.services.studio.flashcard_service import FlashcardService
from app.services.studio.infographic_service import InfographicService
from app.services.studio.mindmap_service import MindMapService
from app.services.studio.presentation_service import PresentationService
from app.services.studio.quiz_service import QuizService
from app.services.studio.report_service import ReportService
from app.services.studio.video_service import VideoOverviewService

logger = get_logger("api.studio")
router = APIRouter(prefix="/notebooks/{notebook_id}/studio", tags=["Studio Tools"])


# --- Schemas ---

class StudioGenerateRequest(BaseModel):
    topic_focus: Optional[str] = Field(default=None, description="Optional custom focus, question, or instruction")
    source_ids: Optional[List[uuid.UUID]] = Field(default=None, description="Specific sources to ground on; defaults to all active")
    options: Dict[str, Any] = Field(default_factory=dict, description="Tool-specific generation options (e.g. theme, report_type)")

    @model_validator(mode="before")
    @classmethod
    def normalize_request(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # 1. Map 'topic' to 'topic_focus'
        if "topic" in data and not data.get("topic_focus"):
            data["topic_focus"] = data["topic"]

        # 2. Map 'settings' into 'options'
        options = dict(data.get("options") or {})
        settings = data.get("settings")
        if isinstance(settings, dict):
            for k, v in settings.items():
                if k not in options:
                    options[k] = v

        # 3. Normalize question_count / quiz_count ("fewer", "standard", "more")
        count_map = {"fewer": 3, "standard": 5, "more": 8}
        raw_qc = options.get("question_count") or options.get("quiz_count")
        if raw_qc is not None:
            if isinstance(raw_qc, str):
                options["question_count"] = count_map.get(raw_qc.lower(), 5)
            elif isinstance(raw_qc, (int, float)):
                options["question_count"] = int(raw_qc)

        # 4. Normalize card_count ("fewer", "standard", "more")
        card_count_map = {"fewer": 5, "standard": 8, "more": 12}
        raw_cc = options.get("card_count")
        if raw_cc is not None:
            if isinstance(raw_cc, str):
                options["card_count"] = card_count_map.get(raw_cc.lower(), 8)
            elif isinstance(raw_cc, (int, float)):
                options["card_count"] = int(raw_cc)

        data["options"] = options
        return data


# --- Helpers ---

async def _gather_sources_content(
    db: AsyncSession, notebook_id: uuid.UUID, source_ids: Optional[List[uuid.UUID]] = None
) -> List[Dict[str, Any]]:
    """Retrieve content text for active notebook sources."""
    stmt = select(NotebookSource).where(
        NotebookSource.notebook_id == notebook_id,
        NotebookSource.is_active_for_queries == True,
    )
    if source_ids:
        stmt = stmt.where(NotebookSource.id.in_(source_ids))

    sources = (await db.execute(stmt)).scalars().all()
    if not sources:
        raise HTTPException(
            status_code=400,
            detail="No active knowledge sources found in this notebook. Please add or enable at least one source.",
        )

    sources_data = []
    for s in sources:
        content = s.raw_content or ""
        # If it points to an ingested document with chunks in DB, fetch chunks
        if s.document_id and len(content) < 100:
            chunk_stmt = (
                select(DocumentChunk)
                .where(DocumentChunk.document_id == s.document_id)
                .order_by(DocumentChunk.chunk_index.asc())
                .limit(20)
            )
            chunks = (await db.execute(chunk_stmt)).scalars().all()
            if chunks:
                content = "\n\n".join(c.content for c in chunks if c.content)
            else:
                from app.models.document import DocumentPage
                page_stmt = (
                    select(DocumentPage)
                    .where(DocumentPage.document_id == s.document_id)
                    .order_by(DocumentPage.page_number.asc())
                    .limit(10)
                )
                pages = (await db.execute(page_stmt)).scalars().all()
                if pages:
                    content = "\n\n".join(p.content for p in pages if p.content)

        if not content.strip():
            content = f"Source Title: {s.title}\nSource Type: {s.source_type}\nActive knowledge resource for notebook intelligence."

        sources_data.append({
            "id": str(s.id),
            "title": s.title,
            "source_type": s.source_type,
            "content": content[:8000],  # bounded per source
        })

    return sources_data


# --- Endpoints ---

@router.post("/audio", status_code=status.HTTP_201_CREATED)
async def generate_audio_overview(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate two-host conversational podcast script and neural audio file."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = AudioOverviewService()

    result = await service.create_audio_overview(
        workspace_id=workspace.id,
        notebook_id=notebook_id,
        sources_data=sources_data,
        topic_focus=payload.topic_focus,
        duration_style=payload.options.get("duration_style", "standard"),
        language=payload.options.get("language", "en"),
    )

    # Persist StudioArtifact
    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="audio_overview",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        export_file_path=result.get("audio_file_path"),
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    audio_rec = AudioGeneration(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        format=payload.options.get("duration_style", "standard"),
        language=result["language"],
        voice_host_a=result["voice_host_a"],
        voice_host_b=result["voice_host_b"],
        dialogue_json=result["dialogue"],
        audio_file_path=result.get("audio_file_path"),
        duration_seconds=result.get("duration_seconds", 0.0),
    )
    db.add(audio_rec)
    await db.commit()
    await db.refresh(artifact)

    return {
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.post("/presentation", status_code=status.HTTP_201_CREATED)
@router.post("/slides", status_code=status.HTTP_201_CREATED)
async def generate_presentation(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate slide deck presentation and export real PowerPoint (.pptx)."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = PresentationService()

    result = await service.generate_slide_deck(
        workspace_id=workspace.id,
        notebook_id=notebook_id,
        sources_data=sources_data,
        topic_focus=payload.topic_focus,
        slide_count=payload.options.get("slide_count", 6),
        theme=payload.options.get("theme", "modern_dark"),
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="presentation",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        export_file_path=result.get("pptx_file_path"),
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    pres = Presentation(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        theme=result["theme"],
        slide_count=result["slide_count"],
        slides_json=result["slides"],
        pptx_file_path=result.get("pptx_file_path"),
    )
    db.add(pres)
    await db.commit()
    await db.refresh(artifact)

    return {
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
    }


@router.post("/report", status_code=status.HTTP_201_CREATED)
async def generate_report(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate structured report and export real Word (.docx) document."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = ReportService()

    result = await service.generate_report(
        workspace_id=workspace.id,
        notebook_id=notebook_id,
        sources_data=sources_data,
        report_type=payload.options.get("report_type", "executive_summary"),
        custom_instructions=payload.topic_focus,
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="report",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        export_file_path=result.get("docx_file_path"),
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    rep = Report(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        report_type=result["report_type"],
        content_markdown=result["content_markdown"],
        table_of_contents_json=result["table_of_contents"],
        docx_file_path=result.get("docx_file_path"),
    )
    db.add(rep)
    await db.commit()
    await db.refresh(artifact)

    return {
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
    }


@router.post("/flashcards", status_code=status.HTTP_201_CREATED)
async def generate_flashcards(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate interactive flashcard study deck."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = FlashcardService()

    result = await service.generate_deck(
        sources_data=sources_data,
        topic_focus=payload.topic_focus,
        card_count=payload.options.get("card_count", 8),
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="flashcards",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    deck = FlashcardDeck(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        card_count=result["card_count"],
        cards_json=result["cards"],
    )
    db.add(deck)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": str(artifact.id),
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.post("/quiz", status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate interactive assessment quiz with rationales and citations."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = QuizService()

    result = await service.generate_quiz(
        sources_data=sources_data,
        topic_focus=payload.topic_focus,
        question_count=payload.options.get("question_count", 5),
        difficulty=payload.options.get("difficulty", "medium"),
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="quiz",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    q = Quiz(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        question_count=result["question_count"],
        questions_json=result["questions"],
    )
    db.add(q)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": str(artifact.id),
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.post("/mindmap", status_code=status.HTTP_201_CREATED)
async def generate_mindmap(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate concept knowledge graph and relationship taxonomy."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = MindMapService()

    result = await service.generate_mindmap(
        sources_data=sources_data,
        topic_focus=payload.topic_focus,
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="mind_map",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    mm = MindMap(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        root_node_title=result["root_title"],
        nodes_json=result["nodes"],
        edges_json=result["edges"],
    )
    db.add(mm)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": str(artifact.id),
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.post("/datatable", status_code=status.HTTP_201_CREATED)
@router.post("/data_table", status_code=status.HTTP_201_CREATED)
@router.post("/data_tables", status_code=status.HTTP_201_CREATED)
async def generate_data_table(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Extract structured data table with page citations and export to .xlsx."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = DataTableService()

    result = await service.generate_data_table(
        workspace_id=workspace.id,
        notebook_id=notebook_id,
        sources_data=sources_data,
        extraction_request=payload.topic_focus,
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="data_table",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        export_file_path=result.get("xlsx_file_path"),
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    dt = DataTable(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        columns_json=result["columns"],
        rows_json=result["rows"],
        xlsx_file_path=result.get("xlsx_file_path"),
    )
    db.add(dt)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": str(artifact.id),
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.post("/infographic", status_code=status.HTTP_201_CREATED)
async def generate_infographic(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate structured visual infographic layout."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = InfographicService()

    result = await service.generate_infographic(
        sources_data=sources_data,
        layout_style=payload.options.get("layout_style", "bento_grid"),
        topic_focus=payload.topic_focus,
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="infographic",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    info = Infographic(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        layout_style=result["layout_style"],
        structure_json=result,
    )
    db.add(info)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": str(artifact.id),
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.post("/video", status_code=status.HTTP_201_CREATED)
async def generate_video_overview(
    notebook_id: uuid.UUID,
    payload: StudioGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate scene storyboard and narration script."""
    sources_data = await _gather_sources_content(db, notebook_id, payload.source_ids)
    service = VideoOverviewService()

    result = await service.generate_storyboard(
        sources_data=sources_data,
        video_style=payload.options.get("video_style", "explainer"),
        topic_focus=payload.topic_focus,
    )

    artifact = StudioArtifact(
        notebook_id=notebook_id,
        workspace_id=workspace.id,
        user_id=current_user.id,
        artifact_type="video_overview",
        title=result["title"],
        status="completed",
        selected_source_ids=[s["id"] for s in sources_data],
        data_json=result,
        generation_time_ms=result.get("generation_time_ms", 0.0),
    )
    db.add(artifact)
    await db.flush()

    vid = VideoGeneration(
        artifact_id=artifact.id,
        notebook_id=notebook_id,
        scenes_json=result["scenes"],
        status=result["status"],
    )
    db.add(vid)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": str(artifact.id),
        "artifact_id": str(artifact.id),
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "status": artifact.status,
        "data": artifact.data_json,
        "export_file_path": artifact.export_file_path,
        "generation_time_ms": artifact.generation_time_ms,
    }


@router.get("/artifacts", response_model=List[Dict[str, Any]])
async def list_notebook_artifacts(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> List[Dict[str, Any]]:
    """List all Studio artifacts generated for this notebook."""
    stmt = (
        select(StudioArtifact)
        .where(StudioArtifact.notebook_id == notebook_id, StudioArtifact.workspace_id == workspace.id)
        .order_by(StudioArtifact.created_at.desc())
    )
    artifacts = (await db.execute(stmt)).scalars().all()
    return [
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
    ]


@router.delete("/artifacts/{artifact_id}")
async def delete_artifact(
    notebook_id: uuid.UUID,
    artifact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
) -> Dict[str, Any]:
    """Delete a generated Studio artifact."""
    stmt = select(StudioArtifact).where(
        StudioArtifact.id == artifact_id,
        StudioArtifact.notebook_id == notebook_id,
        StudioArtifact.workspace_id == workspace.id,
    )
    artifact = (await db.execute(stmt)).scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    await db.delete(artifact)
    await db.commit()
    return {"success": True, "deleted_artifact_id": str(artifact_id)}


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact_file(
    notebook_id: uuid.UUID,
    artifact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    workspace: Workspace = Depends(get_active_workspace),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Download the generated binary file (.mp3, .pptx, .docx, .xlsx) for an artifact."""
    stmt = select(StudioArtifact).where(
        StudioArtifact.id == artifact_id,
        StudioArtifact.notebook_id == notebook_id,
        StudioArtifact.workspace_id == workspace.id,
    )
    artifact = (await db.execute(stmt)).scalar_one_or_none()
    if not artifact or not artifact.export_file_path:
        raise HTTPException(status_code=404, detail="Artifact file not found or not yet generated")

    storage = get_storage_adapter(settings)
    file_bytes = await storage.read_file(artifact.export_file_path)

    ext = os.path.splitext(artifact.export_file_path)[1].lower()
    media_types = {
        ".mp3": "audio/mpeg",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".json": "application/json",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    clean_title = "".join(c for c in artifact.title if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")[:40]
    filename = f"{clean_title or 'artifact'}{ext}"
    encoded_filename = urllib.parse.quote(filename)

    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        "Content-Length": str(len(file_bytes)),
    }
    return Response(content=file_bytes, media_type=media_type, headers=headers)

