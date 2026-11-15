"""Reminder Model.

Stores user-confirmed obligations, expiration dates, and renewal reminders extracted from documents.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_COMPAT, Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.action import ActionItem, Notification
    from app.models.document import Document
    from app.models.user import User
    from app.models.workspace import Workspace


class Reminder(Base, UUIDPrimaryKeyMixin):
    """User obligation and deadline reminder."""

    __tablename__ = "reminders"
    __table_args__ = (
        Index("idx_reminders_user_due", "user_id", "due_date"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("action_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="scheduled",
        nullable=False,
        index=True,
    )  # 'scheduled', 'sent', 'snoozed', 'cancelled', 'failed'
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    recurrence_rule: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    snooze_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notification_channels: Mapped[List[str]] = mapped_column(
        JSONB_COMPAT,
        default=lambda: ["in_app"],
        nullable=False,
    )
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
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="reminders")
    document: Mapped[Optional["Document"]] = relationship("Document", back_populates="reminders")
    user: Mapped["User"] = relationship("User", back_populates="reminders")
    action_item: Mapped[Optional["ActionItem"]] = relationship("ActionItem", back_populates="reminders")
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification", back_populates="reminder", cascade="all, delete-orphan"
    )
