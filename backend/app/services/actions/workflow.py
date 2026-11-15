"""Action Workflow Service.

Governs the explicit human-in-the-loop approval workflow:
Candidate suggestions become confirmed ActionItems (and optional Reminders) ONLY upon user approval.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import ActionItem, ActionSuggestion
from app.models.reminder import Reminder
from app.services.actions.models import SuggestionApprovalRequest


class ActionWorkflowService:
    """Handles review, approval, and rejection of candidate action items."""

    async def approve_suggestion(
        self,
        db: AsyncSession,
        suggestion_id: uuid.UUID,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        approval_data: SuggestionApprovalRequest,
    ) -> Tuple[ActionItem, Optional[Reminder]]:
        """Approve a suggestion and turn it into an official ActionItem and optional Reminder."""
        # 1. Fetch suggestion
        stmt = select(ActionSuggestion).where(
            ActionSuggestion.id == suggestion_id,
            ActionSuggestion.workspace_id == workspace_id,
        )
        suggestion = (await db.execute(stmt)).scalar_one_or_none()
        if not suggestion:
            raise ValueError(f"Suggestion {suggestion_id} not found in workspace")

        # 2. Mark suggestion as approved
        suggestion.status = "approved"

        # 3. Create ActionItem
        effective_title = approval_data.title or suggestion.title
        effective_description = approval_data.description or suggestion.description
        effective_due_date = (
            approval_data.due_date
            if approval_data.due_date is not None
            else suggestion.proposed_due_date
        )

        action_item = ActionItem(
            workspace_id=workspace_id,
            user_id=user_id,
            document_id=suggestion.document_id,
            page_number=suggestion.page_number,
            title=effective_title,
            description=effective_description,
            status="pending",
            priority=approval_data.priority.value,
            due_date=effective_due_date,
            timezone="UTC",
            evidence_text=suggestion.evidence_text,
            origin="extracted",
            confidence_score=suggestion.confidence_score,
            notes=approval_data.notes,
        )
        db.add(action_item)
        await db.flush()  # Populates action_item.id

        # 4. Optionally create linked Reminder
        reminder: Optional[Reminder] = None
        if approval_data.create_reminder and effective_due_date:
            reminder_time = effective_due_date
            if approval_data.reminder_lead_time_minutes > 0:
                reminder_time = effective_due_date - timedelta(
                    minutes=approval_data.reminder_lead_time_minutes
                )

            reminder = Reminder(
                workspace_id=workspace_id,
                user_id=user_id,
                document_id=suggestion.document_id,
                action_item_id=action_item.id,
                title=f"Reminder: {effective_title}",
                description=effective_description,
                due_date=reminder_time,
                timezone="UTC",
                status="scheduled",
                is_confirmed=True,
                is_dismissed=False,
                notification_channels=["in_app"],
            )
            db.add(reminder)

        await db.commit()
        await db.refresh(action_item)
        if reminder:
            await db.refresh(reminder)

        return action_item, reminder

    async def dismiss_suggestion(
        self,
        db: AsyncSession,
        suggestion_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> ActionSuggestion:
        """Dismiss candidate suggestion."""
        stmt = select(ActionSuggestion).where(
            ActionSuggestion.id == suggestion_id,
            ActionSuggestion.workspace_id == workspace_id,
        )
        suggestion = (await db.execute(stmt)).scalar_one_or_none()
        if not suggestion:
            raise ValueError(f"Suggestion {suggestion_id} not found in workspace")

        suggestion.status = "dismissed"
        await db.commit()
        await db.refresh(suggestion)
        return suggestion
