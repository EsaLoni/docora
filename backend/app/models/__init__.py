"""UDIP SQLAlchemy 2.0 ORM Models.

Exports all 14 database models for migrations and domain queries.
"""

from app.models.action import (
    ActionItem,
    ActionSuggestion,
    Notification,
    NotificationDelivery,
)
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.chat import Citation, Conversation, Message
from app.models.document import Document, DocumentChunk, DocumentPage
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
from app.models.workspace import Folder, Workspace, WorkspaceMember
from app.models.notebook import (
    Notebook,
    NotebookSource,
    NotebookNote,
    StudioArtifact,
    AudioGeneration,
    Presentation,
    MindMap,
    Report,
    FlashcardDeck,
    Quiz,
    Infographic,
    DataTable,
    VideoGeneration,
)

__all__ = [
    "Base",
    "User",
    "Workspace",
    "WorkspaceMember",
    "Folder",
    "Document",
    "DocumentPage",
    "DocumentChunk",
    "ProcessingJob",
    "Conversation",
    "Message",
    "Citation",
    "Extraction",
    "DocumentSummary",
    "DocumentComparison",
    "DocumentInsight",
    "IntelligenceJob",
    "Reminder",
    "ActionItem",
    "ActionSuggestion",
    "Notification",
    "NotificationDelivery",
    "AuditLog",
    "Notebook",
    "NotebookSource",
    "NotebookNote",
    "StudioArtifact",
    "AudioGeneration",
    "Presentation",
    "MindMap",
    "Report",
    "FlashcardDeck",
    "Quiz",
    "Infographic",
    "DataTable",
    "VideoGeneration",
]
