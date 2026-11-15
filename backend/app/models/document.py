"""Document, Page & Chunk Models.

Master records for uploaded documents, canonical page content, and vector-embedded chunks.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional
import uuid
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_COMPAT, Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.action import ActionItem, ActionSuggestion
    from app.models.chat import Citation
    from app.models.extraction import Extraction
    from app.models.intelligence import DocumentInsight, DocumentSummary
    from app.models.processing_job import ProcessingJob
    from app.models.reminder import Reminder
    from app.models.user import User
    from app.models.workspace import Folder, Workspace


class Document(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Uploaded document master record."""

    __tablename__ = "documents"
    __table_args__ = (
        Index("idx_documents_workspace_active", "workspace_id", "is_deleted"),
        Index("idx_documents_workspace_hash", "workspace_id", "file_hash"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    folder_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True,
    )  # 'PENDING', 'PROCESSING', 'READY', 'FAILED'
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="documents")
    folder: Mapped[Optional["Folder"]] = relationship("Folder", back_populates="documents")
    user: Mapped["User"] = relationship("User", back_populates="documents")
    pages: Mapped[List["DocumentPage"]] = relationship(
        "DocumentPage",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentPage.page_number",
    )
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship(
        "ProcessingJob",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    extractions: Mapped[List["Extraction"]] = relationship(
        "Extraction",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    reminders: Mapped[List["Reminder"]] = relationship(
        "Reminder",
        back_populates="document",
    )
    citations: Mapped[List["Citation"]] = relationship(
        "Citation",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    summaries: Mapped[List["DocumentSummary"]] = relationship(
        "DocumentSummary",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    insights: Mapped[List["DocumentInsight"]] = relationship(
        "DocumentInsight",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    action_items: Mapped[List["ActionItem"]] = relationship(
        "ActionItem",
        back_populates="document",
    )
    action_suggestions: Mapped[List["ActionSuggestion"]] = relationship(
        "ActionSuggestion",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DocumentPage(Base, UUIDPrimaryKeyMixin):
    """Page-level text and layout metadata preserving exact page numbering."""

    __tablename__ = "document_pages"
    __table_args__ = (
        UniqueConstraint("document_id", "page_number", name="uq_doc_page"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    has_images: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ocr_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="pages")
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="page",
        cascade="all, delete-orphan",
    )


class DocumentChunk(Base, UUIDPrimaryKeyMixin):
    """Text passage with 384-dimensional pgvector embedding."""

    __tablename__ = "document_chunks"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding = mapped_column(Vector(384), nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
    page: Mapped["DocumentPage"] = relationship("DocumentPage", back_populates="chunks")
    citations: Mapped[List["Citation"]] = relationship(
        "Citation",
        back_populates="chunk",
        cascade="all, delete-orphan",
    )
