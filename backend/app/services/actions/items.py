"""Action Item CRUD and Lifecycle Management Service."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import ActionItem
from app.models.reminder import Reminder
from app.services.actions.models import ActionItemCreate, ActionItemUpdate


class ActionItemService:
    """Service for managing confirmed action items."""

    async def create_action_item(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ActionItemCreate,
    ) -> Tuple[ActionItem, Optional[Reminder]]:
        """Create a new action item manually or programmatically."""
        action_item = ActionItem(
            workspace_id=workspace_id,
            user_id=user_id,
            document_id=data.document_id,
            page_number=data.page_number,
            title=data.title,
            description=data.description,
            priority=data.priority.value,
            status=data.status.value,
            due_date=data.due_date,
            timezone=data.timezone,
            evidence_text=data.evidence_text,
            origin=data.origin.value,
            notes=data.notes,
        )
        db.add(action_item)
        await db.flush()

        reminder: Optional[Reminder] = None
        if data.create_reminder and data.due_date:
            reminder_time = data.due_date
            if data.reminder_lead_time_minutes > 0:
                reminder_time = data.due_date - timedelta(minutes=data.reminder_lead_time_minutes)

            reminder = Reminder(
                workspace_id=workspace_id,
                user_id=user_id,
                document_id=data.document_id,
                action_item_id=action_item.id,
                title=f"Reminder: {data.title}",
                description=data.description,
                due_date=reminder_time,
                timezone=data.timezone,
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

    async def get_action_items(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        document_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[ActionItem], int]:
        """Query action items with filtering and workspace tenant isolation."""
        query = select(ActionItem).where(ActionItem.workspace_id == workspace_id)
        count_query = select(func.count(ActionItem.id)).where(ActionItem.workspace_id == workspace_id)

        if status:
            query = query.where(ActionItem.status == status)
            count_query = count_query.where(ActionItem.status == status)

        if priority:
            query = query.where(ActionItem.priority == priority)
            count_query = count_query.where(ActionItem.priority == priority)

        if document_id:
            query = query.where(ActionItem.document_id == document_id)
            count_query = count_query.where(ActionItem.document_id == document_id)

        query = query.order_by(ActionItem.due_date.asc().nullslast(), ActionItem.created_at.desc()).limit(limit).offset(offset)

        total = (await db.execute(count_query)).scalar() or 0
        items = (await db.execute(query)).scalars().all()

        return list(items), total

    async def get_action_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[ActionItem]:
        """Fetch action item by ID with workspace boundary check."""
        stmt = select(ActionItem).where(
            ActionItem.id == item_id,
            ActionItem.workspace_id == workspace_id,
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def update_action_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        workspace_id: uuid.UUID,
        data: ActionItemUpdate,
    ) -> Optional[ActionItem]:
        """Update fields on an action item."""
        item = await self.get_action_item(db, item_id, workspace_id)
        if not item:
            return None

        if data.title is not None:
            item.title = data.title
        if data.description is not None:
            item.description = data.description
        if data.priority is not None:
            item.priority = data.priority.value
        if data.status is not None:
            item.status = data.status.value
            if item.status == "completed" and item.completed_at is None:
                item.completed_at = datetime.now(timezone.utc)
            elif item.status != "completed":
                item.completed_at = None
        if data.due_date is not None:
            item.due_date = data.due_date
        if data.timezone is not None:
            item.timezone = data.timezone
        if data.notes is not None:
            item.notes = data.notes

        await db.commit()
        await db.refresh(item)
        return item

    async def complete_action_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[ActionItem]:
        """Mark action item as completed."""
        item = await self.get_action_item(db, item_id, workspace_id)
        if not item:
            return None

        item.status = "completed"
        item.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(item)
        return item

    async def reopen_action_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[ActionItem]:
        """Reopen a completed or dismissed action item."""
        item = await self.get_action_item(db, item_id, workspace_id)
        if not item:
            return None

        item.status = "in_progress"
        item.completed_at = None
        await db.commit()
        await db.refresh(item)
        return item

    async def dismiss_action_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[ActionItem]:
        """Dismiss action item."""
        item = await self.get_action_item(db, item_id, workspace_id)
        if not item:
            return None

        item.status = "dismissed"
        await db.commit()
        await db.refresh(item)
        return item

    async def delete_action_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> bool:
        """Permanently delete an action item."""
        item = await self.get_action_item(db, item_id, workspace_id)
        if not item:
            return False

        await db.delete(item)
        await db.commit()
        return True
