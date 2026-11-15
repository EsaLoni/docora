"""Action Item, Suggestion, and Notification Models.

Defines:
- ActionItem: User-approved trackable task with priority, status, due date, and document lineage.
- ActionSuggestion: Discovered candidate action awaiting user approval/dismissal.
- Notification: In-app notification delivered to user.
- NotificationDelivery: Channel-specific delivery attempts with idempotency tracking.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional
import uuid
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_COMPAT, Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.reminder import Reminder
    from app.models.user import User
    from app.models.workspace import Workspace


class ActionItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User-approved action item derived from document intelligence or manual entry."""

    __tablename__ = "action_items"
    __table_args__ = (
        Index("ix_action_items_workspace_status", "workspace_id", "status"),
        Index("ix_action_items_due_date", "due_date"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
        index=True,
    )  # 'suggested', 'pending', 'in_progress', 'completed', 'dismissed'
    priority: Mapped[str] = mapped_column(
        String(50),
        default="medium",
        nullable=False,
    )  # 'low', 'medium', 'high', 'urgent'
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    evidence_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origin: Mapped[str] = mapped_column(
        String(50),
        default="manual",
        nullable=False,
    )  # 'manual', 'extracted', 'ai_suggested'
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="action_items")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="action_items")
    document: Mapped[Optional["Document"]] = relationship("Document", back_populates="action_items")
    reminders: Mapped[List["Reminder"]] = relationship(
        "Reminder", back_populates="action_item", cascade="all, delete-orphan"
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification", back_populates="action_item", cascade="all, delete-orphan"
    )


class ActionSuggestion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Candidate action discovered from document intelligence awaiting user approval."""

    __tablename__ = "action_suggestions"
    __table_args__ = (
        Index("ix_action_suggestions_workspace_status", "workspace_id", "status"),
    )

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
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposed_due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_date_explicit: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50),
        default="obligation",
        nullable=False,
    )  # 'payment_deadline', 'renewal_date', 'obligation', 'expiration', 'meeting', 'compliance'
    evidence_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="suggested",
        nullable=False,
        index=True,
    )  # 'suggested', 'approved', 'dismissed'

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="action_suggestions")
    document: Mapped["Document"] = relationship("Document", back_populates="action_suggestions")


class Notification(Base, UUIDPrimaryKeyMixin):
    """In-app alert notification delivered to the user."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read"),
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
    reminder_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reminders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("action_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(
        String(50),
        default="reminder",
        nullable=False,
    )  # 'reminder', 'deadline', 'system', 'suggestion'
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="notifications")
    user: Mapped["User"] = relationship("User", back_populates="notifications")
    reminder: Mapped[Optional["Reminder"]] = relationship("Reminder", back_populates="notifications")
    action_item: Mapped[Optional["ActionItem"]] = relationship("ActionItem", back_populates="notifications")
    deliveries: Mapped[List["NotificationDelivery"]] = relationship(
        "NotificationDelivery", back_populates="notification", cascade="all, delete-orphan"
    )


class NotificationDelivery(Base, UUIDPrimaryKeyMixin):
    """Delivery log record ensuring idempotency and channel audit."""

    __tablename__ = "notification_deliveries"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(50), default="in_app", nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="delivered",
        nullable=False,
    )  # 'pending', 'delivered', 'failed'
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    notification: Mapped["Notification"] = relationship("Notification", back_populates="deliveries")
