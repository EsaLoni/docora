"""Schemas and DTOs for Action Items, Suggestions, Reminders, and Notifications."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


# --- Enums ---

class ActionPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ActionStatus(str, Enum):
    SUGGESTED = "suggested"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DISMISSED = "dismissed"


class ActionOrigin(str, Enum):
    MANUAL = "manual"
    EXTRACTED = "extracted"
    AI_SUGGESTED = "ai_suggested"


class ReminderStatus(str, Enum):
    SCHEDULED = "scheduled"
    SENT = "sent"
    SNOOZED = "snoozed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class SuggestionStatus(str, Enum):
    SUGGESTED = "suggested"
    APPROVED = "approved"
    DISMISSED = "dismissed"


class SuggestionCategory(str, Enum):
    PAYMENT_DEADLINE = "payment_deadline"
    RENEWAL_DATE = "renewal_date"
    EXPIRATION = "expiration"
    COMPLIANCE = "compliance"
    MEETING = "meeting"
    DELIVERY = "delivery"
    APPROVAL = "approval"
    FOLLOW_UP = "follow_up"
    OBLIGATION = "obligation"
    OTHER = "other"


# --- Action Items ---

class ActionItemCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    priority: ActionPriority = ActionPriority.MEDIUM
    status: ActionStatus = ActionStatus.PENDING
    due_date: Optional[datetime] = None
    timezone: str = "UTC"
    document_id: Optional[uuid.UUID] = None
    page_number: Optional[int] = None
    evidence_text: Optional[str] = None
    origin: ActionOrigin = ActionOrigin.MANUAL
    notes: Optional[str] = None
    create_reminder: bool = False
    reminder_lead_time_minutes: int = 0


class ActionItemUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    priority: Optional[ActionPriority] = None
    status: Optional[ActionStatus] = None
    due_date: Optional[datetime] = None
    timezone: Optional[str] = None
    notes: Optional[str] = None


class ActionItemResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    page_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    timezone: str
    evidence_text: Optional[str] = None
    origin: str
    confidence_score: Optional[float] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActionItemListResponse(BaseModel):
    items: List[ActionItemResponse]
    total: int


# --- Action Suggestions ---

class ActionSuggestionResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    document_id: uuid.UUID
    page_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    proposed_due_date: Optional[datetime] = None
    is_date_explicit: bool
    category: str
    evidence_text: str
    confidence_score: float
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActionSuggestionListResponse(BaseModel):
    items: List[ActionSuggestionResponse]
    total: int


class SuggestionApprovalRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: ActionPriority = ActionPriority.MEDIUM
    notes: Optional[str] = None
    create_reminder: bool = True
    reminder_lead_time_minutes: int = 0


# --- Reminders ---

class ReminderCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    due_date: datetime
    timezone: str = "UTC"
    recurrence_rule: Optional[str] = None
    action_item_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    notification_channels: List[str] = ["in_app"]


class ReminderUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    timezone: Optional[str] = None
    recurrence_rule: Optional[str] = None
    status: Optional[str] = None


class ReminderSnoozeRequest(BaseModel):
    snooze_until: Optional[datetime] = None
    snooze_minutes: Optional[int] = None


class ReminderResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    document_id: Optional[uuid.UUID] = None
    action_item_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    due_date: datetime
    timezone: str
    status: str
    recurrence_rule: Optional[str] = None
    snooze_until: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    notification_channels: List[str]
    metadata_json: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReminderListResponse(BaseModel):
    items: List[ReminderResponse]
    total: int


# --- Notifications ---

class NotificationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    reminder_id: Optional[uuid.UUID] = None
    action_item_id: Optional[uuid.UUID] = None
    title: str
    message: str
    notification_type: str
    is_read: bool
    read_at: Optional[datetime] = None
    metadata_json: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int


# --- Discovery DTOs ---

class DiscoveredActionItem(BaseModel):
    title: str
    description: Optional[str] = None
    proposed_due_date: Optional[datetime] = None
    is_date_explicit: bool = True
    category: SuggestionCategory = SuggestionCategory.OBLIGATION
    evidence_text: str
    confidence_score: float = 0.9
    page_number: Optional[int] = None


class ActionDiscoveryResult(BaseModel):
    document_id: uuid.UUID
    total_discovered: int
    suggestions: List[DiscoveredActionItem]
