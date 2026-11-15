"""Extraction Model.

Stores structured data extracted from documents against schema definitions.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, Optional
import uuid
from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_COMPAT, Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.workspace import Workspace


class Extraction(Base, UUIDPrimaryKeyMixin):
    """Structured data extracted from a document."""

    __tablename__ = "extractions"

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
    extraction_type: Mapped[str] = mapped_column(String(100), nullable=False)
    schema_definition: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
    )
    extracted_data: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="COMPLETED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="extractions")
    document: Mapped["Document"] = relationship("Document", back_populates="extractions")
