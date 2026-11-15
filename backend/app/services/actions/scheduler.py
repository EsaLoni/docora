"""Durable Reminder Scheduler.

Scans for due and snoozed reminders, triggers notifications, advances recurring schedules,
and maintains idempotent delivery guarantees.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.action import Notification
from app.models.reminder import Reminder
from app.services.actions.notification_provider import BaseNotificationProvider, InAppNotificationProvider
from app.services.actions.reminders import ReminderService

logger = get_logger("services.actions.scheduler")


class ReminderScheduler:
    """Asynchronous polling scheduler for due reminders."""

    def __init__(self, notification_provider: Optional[BaseNotificationProvider] = None) -> None:
        self.notification_provider = notification_provider or InAppNotificationProvider()

    async def dispatch_due_reminders(
        self,
        db: AsyncSession,
        current_time: Optional[datetime] = None,
    ) -> int:
        """Find all due reminders and dispatch notifications."""
        now = current_time or datetime.now(timezone.utc)

        # Query reminders that are scheduled or snoozed and due
        stmt = (
            select(Reminder)
            .where(
                Reminder.is_dismissed.is_(False),
                or_(
                    (Reminder.status == "scheduled") & (Reminder.due_date <= now),
                    (Reminder.status == "snoozed") & (Reminder.snooze_until <= now),
                ),
            )
            .order_by(Reminder.due_date.asc())
        )

        reminders = (await db.execute(stmt)).scalars().all()
        if not reminders:
            return 0

        dispatched_count = 0
        for reminder in reminders:
            try:
                # 1. Derive an idempotency key for this alert cycle
                date_anchor = reminder.snooze_until.isoformat() if (reminder.status == "snoozed" and reminder.snooze_until) else reminder.due_date.isoformat()
                idempotency_key = f"reminder:{reminder.id}:{date_anchor}"

                # 2. Create in-app notification record
                notification = Notification(
                    workspace_id=reminder.workspace_id,
                    user_id=reminder.user_id,
                    reminder_id=reminder.id,
                    action_item_id=reminder.action_item_id,
                    title=reminder.title,
                    message=reminder.description or f"Reminder: '{reminder.title}' is due.",
                    notification_type="reminder",
                    is_read=False,
                    metadata_json={
                        "action_item_id": str(reminder.action_item_id) if reminder.action_item_id else None,
                        "document_id": str(reminder.document_id) if reminder.document_id else None,
                        "due_date": reminder.due_date.isoformat(),
                    },
                )
                db.add(notification)
                await db.flush()

                # 3. Deliver notification via provider with idempotency key
                delivered = await self.notification_provider.deliver(
                    db=db,
                    notification=notification,
                    idempotency_key=idempotency_key,
                )

                if delivered:
                    # 4. Advance recurrence or transition status to sent
                    if reminder.recurrence_rule:
                        next_due = ReminderService.compute_next_occurrence(
                            reminder.due_date, reminder.recurrence_rule
                        )
                        reminder.due_date = next_due or (reminder.due_date + (now - reminder.due_date))
                        reminder.status = "scheduled"
                        reminder.snooze_until = None
                        reminder.sent_at = now
                    else:
                        reminder.status = "sent"
                        reminder.sent_at = now

                    dispatched_count += 1
            except Exception as e:
                logger.error("Failed to process due reminder %s: %s", reminder.id, e)

        if dispatched_count > 0:
            await db.commit()

        return dispatched_count
