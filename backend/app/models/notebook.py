"""UDIP Phase 11 Notebook and Studio Data Models.

Defines persistence for notebooks, multi-type sources, notes, and the 9 Studio tools:
Audio Overview, Video Overview, Slide Deck, Mind Map, Reports, Flashcards,
Quizzes, Infographics, Data Tables, and background Generation Jobs.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, JSONB_COMPAT, TimestampMixin, UUIDPrimaryKeyMixin


class Notebook(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Container notebook representing a research subject with sources, chat, notes, and studio artifacts."""

    __tablename__ = "notebooks"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Notebook")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    color: Mapped[str] = mapped_column(String(32), default="blue", nullable=False)
    
    # Custom instructions, default response mode, model settings
    settings_json: Mapped[Dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)

    # Relationships
    sources: Mapped[List["NotebookSource"]] = relationship(
        "NotebookSource", back_populates="notebook", cascade="all, delete-orphan"
    )
    notes: Mapped[List["NotebookNote"]] = relationship(
        "NotebookNote", back_populates="notebook", cascade="all, delete-orphan"
    )
    artifacts: Mapped[List["StudioArtifact"]] = relationship(
        "StudioArtifact", back_populates="notebook", cascade="all, delete-orphan"
    )


class NotebookSource(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Knowledge source attached to a notebook (document, web URL, YouTube, text note, audio)."""

    __tablename__ = "notebook_sources"

    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(
        String(32), default="document", nullable=False
    )  # document, url, youtube, text_note, audio
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    raw_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Whether this source is active for RAG context selection in queries
    is_active_for_queries: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    extraction_status: Mapped[str] = mapped_column(
        String(32), default="completed", nullable=False
    )  # pending, processing, completed, failed
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)

    notebook: Mapped["Notebook"] = relationship("Notebook", back_populates="sources")


class NotebookNote(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User-authored or AI-saved note within a notebook."""

    __tablename__ = "notebook_notes"

    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), default="Untitled Note", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    source_citations_json: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB_COMPAT, default=list, nullable=False
    )
    color: Mapped[str] = mapped_column(String(32), default="default", nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notebook: Mapped["Notebook"] = relationship("Notebook", back_populates="notes")


class StudioArtifact(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Base artifact generated by any of the 9 Studio tools."""

    __tablename__ = "studio_artifacts"

    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    artifact_type: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True
    )  # audio_overview, video_overview, presentation, mind_map, report, flashcards, quiz, infographic, data_table
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="completed", nullable=False, index=True
    )  # pending, processing, completed, failed
    
    selected_source_ids: Mapped[List[str]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    data_json: Mapped[Dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    export_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generation_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    notebook: Mapped["Notebook"] = relationship("Notebook", back_populates="artifacts")


class AudioGeneration(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Audio overview / podcast episode generated by AI."""

    __tablename__ = "audio_generations"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    format: Mapped[str] = mapped_column(String(32), default="two_host_podcast", nullable=False)
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    voice_host_a: Mapped[str] = mapped_column(String(64), default="en-US-GuyNeural", nullable=False)
    voice_host_b: Mapped[str] = mapped_column(String(64), default="en-US-JennyNeural", nullable=False)
    dialogue_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    audio_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    audio_format: Mapped[str] = mapped_column(String(16), default="mp3", nullable=False)


class Presentation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Slide deck presentation metadata and slide collection."""

    __tablename__ = "presentations"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    theme: Mapped[str] = mapped_column(String(32), default="modern_dark", nullable=False)
    slide_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    slides_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    pptx_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)


class MindMap(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Knowledge graph / mind map representation."""

    __tablename__ = "mind_maps"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    root_node_title: Mapped[str] = mapped_column(String(255), nullable=False)
    nodes_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    edges_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)


class Report(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Structured report of one of 12 archetypes."""

    __tablename__ = "reports"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_type: Mapped[str] = mapped_column(String(64), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    table_of_contents_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    docx_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)


class FlashcardDeck(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Interactive flashcard deck for learning and spaced repetition."""

    __tablename__ = "flashcard_decks"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)


class Quiz(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Interactive assessment quiz with questions, citations, and attempt tracking."""

    __tablename__ = "quizzes"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    questions_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)


class Infographic(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Visual infographic structure (Bento grid, process, comparison)."""

    __tablename__ = "infographics"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    layout_style: Mapped[str] = mapped_column(String(32), default="bento_grid", nullable=False)
    structure_json: Mapped[Dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)


class DataTable(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Structured data table extracted from documents with column schemas."""

    __tablename__ = "data_tables"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    columns_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    rows_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    xlsx_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)


class VideoGeneration(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Video overview storyboard and narration generation record."""

    __tablename__ = "video_generations"

    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenes_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="storyboard_ready", nullable=False)
    video_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
