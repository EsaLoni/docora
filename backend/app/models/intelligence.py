"""Intelligence Models for UDIP.

Persists reusable document intelligence artifacts:
- DocumentSummary: quick, detailed, section-wise, and custom hierarchical summaries.
- DocumentComparison: multi-document comparisons with structured difference tables.
- DocumentInsight: source-backed key findings, risks, dates, and trends.
- IntelligenceJob: durable asynchronous job tracking for heavy analysis tasks.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional
import uuid
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_COMPAT, Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.workspace import Workspace


class DocumentSummary(Base, UUIDPrimaryKeyMixin):
    """Persisted summary for one or more documents."""

    __tablename__ = "document_summaries"

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
    summary_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # 'quick', 'detailed', 'section_wise', 'custom'
    custom_instruction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_data: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    citations: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    model: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False)
    provider: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="summaries")
    document: Mapped["Document"] = relationship("Document", back_populates="summaries")


class DocumentComparison(Base, UUIDPrimaryKeyMixin):
    """Persisted multi-document comparison report with structured difference matrix."""

    __tablename__ = "document_comparisons"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_ids: Mapped[List[str]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    comparison_type: Mapped[str] = mapped_column(
        String(50),
        default="comprehensive",
        nullable=False,
        index=True,
    )  # 'comprehensive', 'financial', 'clauses', 'custom'
    custom_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_differences: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    citations: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    model: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False)
    provider: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="comparisons")


class DocumentInsight(Base, UUIDPrimaryKeyMixin):
    """Individual source-backed insight extracted from a document."""

    __tablename__ = "document_insights"

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
    insight_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # 'key_finding', 'risk', 'deadline', 'financial', 'trend', 'action_item', 'contradiction', 'missing_info'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50),
        default="directly_extracted_fact",
        nullable=False,
    )  # 'directly_extracted_fact', 'llm_interpretation', 'calculated_metric', 'unverified_observation'
    evidence_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    citations: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="insights")
    document: Mapped["Document"] = relationship("Document", back_populates="insights")


class IntelligenceJob(Base, UUIDPrimaryKeyMixin):
    """Durable asynchronous job tracking for heavy intelligence operations."""

    __tablename__ = "intelligence_jobs"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # 'SUMMARIZE', 'COMPARE', 'EXTRACT', 'INSIGHTS'
    document_ids: Mapped[List[str]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="QUEUED",
        nullable=False,
        index=True,
    )  # 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parameters_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    result_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="intelligence_jobs")
