"""Reminder Service.

Handles scheduling, snoozing, cancellation, and recurrence advancement for user reminders.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid
from dateutil import rrule
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.services.actions.models import ReminderCreate, ReminderUpdate


class ReminderService:
    """Service for managing reminders and alert schedules."""

    async def create_reminder(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ReminderCreate,
    ) -> Reminder:
        """Create a new scheduled reminder."""
        reminder = Reminder(
            workspace_id=workspace_id,
            user_id=user_id,
            document_id=data.document_id,
            action_item_id=data.action_item_id,
            title=data.title,
            description=data.description,
            due_date=data.due_date,
            timezone=data.timezone,
            recurrence_rule=data.recurrence_rule,
            status="scheduled",
            is_confirmed=True,
            is_dismissed=False,
            notification_channels=data.notification_channels,
        )
        db.add(reminder)
        await db.commit()
        await db.refresh(reminder)
        return reminder

    async def get_reminders(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        status: Optional[str] = None,
        upcoming_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Reminder], int]:
        """Query reminders with workspace isolation."""
        query = select(Reminder).where(
            Reminder.workspace_id == workspace_id,
            Reminder.is_dismissed.is_(False),
        )
        count_query = select(func.count(Reminder.id)).where(
            Reminder.workspace_id == workspace_id,
            Reminder.is_dismissed.is_(False),
        )

        if status:
            query = query.where(Reminder.status == status)
            count_query = count_query.where(Reminder.status == status)

        if upcoming_only:
            now = datetime.now(timezone.utc)
            query = query.where(Reminder.due_date >= now)
            count_query = count_query.where(Reminder.due_date >= now)

        query = query.order_by(Reminder.due_date.asc()).limit(limit).offset(offset)

        total = (await db.execute(count_query)).scalar() or 0
        reminders = (await db.execute(query)).scalars().all()

        return list(reminders), total

    async def get_reminder(
        self,
        db: AsyncSession,
        reminder_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[Reminder]:
        """Fetch a single reminder with tenant isolation check."""
        stmt = select(Reminder).where(
            Reminder.id == reminder_id,
            Reminder.workspace_id == workspace_id,
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def update_reminder(
        self,
        db: AsyncSession,
        reminder_id: uuid.UUID,
        workspace_id: uuid.UUID,
        data: ReminderUpdate,
    ) -> Optional[Reminder]:
        """Update reminder metadata or due time."""
        reminder = await self.get_reminder(db, reminder_id, workspace_id)
        if not reminder:
            return None

        if data.title is not None:
            reminder.title = data.title
        if data.description is not None:
            reminder.description = data.description
        if data.due_date is not None:
            reminder.due_date = data.due_date
        if data.timezone is not None:
            reminder.timezone = data.timezone
        if data.recurrence_rule is not None:
            reminder.recurrence_rule = data.recurrence_rule
        if data.status is not None:
            reminder.status = data.status

        await db.commit()
        await db.refresh(reminder)
        return reminder

    async def snooze_reminder(
        self,
        db: AsyncSession,
        reminder_id: uuid.UUID,
        workspace_id: uuid.UUID,
        snooze_until: Optional[datetime] = None,
        snooze_minutes: Optional[int] = None,
    ) -> Optional[Reminder]:
        """Snooze a reminder to a future time."""
        reminder = await self.get_reminder(db, reminder_id, workspace_id)
        if not reminder:
            return None

        target_time: datetime
        if snooze_until:
            target_time = snooze_until
        elif snooze_minutes:
            target_time = datetime.now(timezone.utc) + timedelta(minutes=snooze_minutes)
        else:
            # Default snooze: 1 day
            target_time = datetime.now(timezone.utc) + timedelta(days=1)

        reminder.snooze_until = target_time
        reminder.status = "snoozed"

        await db.commit()
        await db.refresh(reminder)
        return reminder

    async def cancel_reminder(
        self,
        db: AsyncSession,
        reminder_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> Optional[Reminder]:
        """Cancel a scheduled reminder."""
        reminder = await self.get_reminder(db, reminder_id, workspace_id)
        if not reminder:
            return None

        reminder.status = "cancelled"
        await db.commit()
        await db.refresh(reminder)
        return reminder

    async def delete_reminder(
        self,
        db: AsyncSession,
        reminder_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> bool:
        """Permanently delete a reminder."""
        reminder = await self.get_reminder(db, reminder_id, workspace_id)
        if not reminder:
            return False

        await db.delete(reminder)
        await db.commit()
        return True

    @staticmethod
    def compute_next_occurrence(current_due: datetime, rrule_str: str) -> Optional[datetime]:
        """Compute next occurrence based on simple rule or RFC 5545 rrule string."""
        if not rrule_str:
            return None

        rule_upper = rrule_str.upper()
        try:
            if "FREQ=DAILY" in rule_upper:
                return current_due + timedelta(days=1)
            elif "FREQ=WEEKLY" in rule_upper:
                return current_due + timedelta(weeks=1)
            elif "FREQ=MONTHLY" in rule_upper:
                # Approximation: 30 days
                return current_due + timedelta(days=30)
            elif "FREQ=YEARLY" in rule_upper:
                return current_due + timedelta(days=365)
            else:
                # Try dateutil rrulestr
                rule = rrule.rrulestr(rrule_str, dtstart=current_due)
                next_date = rule.after(current_due)
                if next_date and next_date.tzinfo is None:
                    next_date = next_date.replace(tzinfo=timezone.utc)
                return next_date
        except Exception:
            # Default fallback 1 day
            return current_due + timedelta(days=1)
