"""User Model.

Represents an authenticated user profile synchronized with Supabase Auth or local auth.
"""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.action import ActionItem, Notification
    from app.models.audit import AuditLog
    from app.models.chat import Conversation
    from app.models.document import Document
    from app.models.reminder import Reminder
    from app.models.workspace import Workspace, WorkspaceMember


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User profile record."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    supabase_uid: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)  # 'user', 'admin'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Login tracking
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    login_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    # Relationships
    owned_workspaces: Mapped[List["Workspace"]] = relationship(
        "Workspace",
        back_populates="owner",
        cascade="all, delete-orphan",
        foreign_keys="Workspace.owner_id",
    )
    memberships: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="user",
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    reminders: Mapped[List["Reminder"]] = relationship(
        "Reminder",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    action_items: Mapped[List["ActionItem"]] = relationship(
        "ActionItem",
        back_populates="user",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
    )
