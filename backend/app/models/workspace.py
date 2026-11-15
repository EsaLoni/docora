"""Workspace & Folder Models.

Defines multi-tenant workspaces, membership roles, and hierarchical document folders.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional
import uuid
from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_COMPAT, Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.action import ActionItem, ActionSuggestion, Notification
    from app.models.audit import AuditLog
    from app.models.chat import Conversation
    from app.models.document import Document
    from app.models.extraction import Extraction
    from app.models.intelligence import (
        DocumentComparison,
        DocumentInsight,
        DocumentSummary,
        IntelligenceJob,
    )
    from app.models.processing_job import ProcessingJob
    from app.models.reminder import Reminder
    from app.models.user import User


class Workspace(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Multi-tenant workspace boundary for user documents and conversations."""

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    settings: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )

    # Relationships
    owner: Mapped["User"] = relationship(
        "User",
        back_populates="owned_workspaces",
        foreign_keys=[owner_id],
    )
    members: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    folders: Mapped[List["Folder"]] = relationship(
        "Folder",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship(
        "ProcessingJob",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    extractions: Mapped[List["Extraction"]] = relationship(
        "Extraction",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    reminders: Mapped[List["Reminder"]] = relationship(
        "Reminder",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    summaries: Mapped[List["DocumentSummary"]] = relationship(
        "DocumentSummary",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    comparisons: Mapped[List["DocumentComparison"]] = relationship(
        "DocumentComparison",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    insights: Mapped[List["DocumentInsight"]] = relationship(
        "DocumentInsight",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    intelligence_jobs: Mapped[List["IntelligenceJob"]] = relationship(
        "IntelligenceJob",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    action_items: Mapped[List["ActionItem"]] = relationship(
        "ActionItem",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    action_suggestions: Mapped[List["ActionSuggestion"]] = relationship(
        "ActionSuggestion",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class WorkspaceMember(Base, UUIDPrimaryKeyMixin):
    """Associates users with workspaces and defines their role-based permissions."""

    __tablename__ = "workspace_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),
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
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="member",
        nullable=False,
    )  # 'owner', 'admin', 'member', 'viewer'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="memberships")


class Folder(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Hierarchical folder organization within a workspace."""

    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("workspace_id", "parent_id", "name", name="uq_folder_name_in_parent"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(7), default="#4F46E5", nullable=True)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="folders")
    parent: Mapped[Optional["Folder"]] = relationship(
        "Folder",
        remote_side="Folder.id",
        back_populates="children",
    )
    children: Mapped[List["Folder"]] = relationship(
        "Folder",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="folder",
    )
