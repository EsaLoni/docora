"""Tests for Reminder Service, Recurrence, and Durable Polling Scheduler."""

import asyncio
from datetime import datetime, timedelta, timezone
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.action import Notification, NotificationDelivery
from app.models.reminder import Reminder
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.models import ReminderCreate, ReminderUpdate
from app.services.actions.reminders import ReminderService
from app.services.actions.scheduler import ReminderScheduler


def test_reminder_crud_and_snooze(session_factory: async_sessionmaker[AsyncSession]):
    """Verify reminder creation, snoozing, cancellation, and deletion."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            service = ReminderService()
            due = datetime.now(timezone.utc) + timedelta(days=3)

            # 1. Create reminder
            reminder = await service.create_reminder(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                data=ReminderCreate(
                    title="Vendor Agreement Renewal Notice",
                    description="Submit non-renewal notice if discontinuing service.",
                    due_date=due,
                    recurrence_rule="FREQ=MONTHLY",
                ),
            )
            assert reminder.id is not None
            assert reminder.title == "Vendor Agreement Renewal Notice"
            assert reminder.status == "scheduled"
            assert reminder.recurrence_rule == "FREQ=MONTHLY"

            # 2. Snooze reminder
            snooze_target = due + timedelta(days=1)
            snoozed = await service.snooze_reminder(
                db=session,
                reminder_id=reminder.id,
                workspace_id=ws.id,
                snooze_until=snooze_target,
            )
            assert snoozed is not None
            assert snoozed.status == "snoozed"
            assert snoozed.snooze_until is not None
            assert snoozed.snooze_until.replace(tzinfo=timezone.utc) == snooze_target

            # 3. Cancel reminder
            cancelled = await service.cancel_reminder(
                db=session,
                reminder_id=reminder.id,
                workspace_id=ws.id,
            )
            assert cancelled is not None
            assert cancelled.status == "cancelled"

            # 4. Delete reminder
            deleted = await service.delete_reminder(
                db=session,
                reminder_id=reminder.id,
                workspace_id=ws.id,
            )
            assert deleted is True

            fetched = await service.get_reminder(session, reminder.id, ws.id)
            assert fetched is None

    asyncio.run(_test())


def test_recurrence_rule_calculation():
    """Verify next occurrence computation across RFC recurrence rules."""
    base_date = datetime(2026, 11, 15, 10, 0, 0, tzinfo=timezone.utc)

    # Daily
    next_daily = ReminderService.compute_next_occurrence(base_date, "FREQ=DAILY")
    assert next_daily == datetime(2026, 11, 16, 10, 0, 0, tzinfo=timezone.utc)

    # Weekly
    next_weekly = ReminderService.compute_next_occurrence(base_date, "FREQ=WEEKLY")
    assert next_weekly == datetime(2026, 11, 22, 10, 0, 0, tzinfo=timezone.utc)

    # Monthly
    next_monthly = ReminderService.compute_next_occurrence(base_date, "FREQ=MONTHLY")
    assert next_monthly is not None
    assert next_monthly > base_date


def test_reminder_scheduler_dispatch_and_idempotency(session_factory: async_sessionmaker[AsyncSession]):
    """Verify reminder scheduler detects due reminders, delivers notifications, advances recurrence, and prevents duplicates."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            now = datetime.now(timezone.utc)
            past_due = now - timedelta(hours=2)

            # 1. One-time due reminder
            rem1 = Reminder(
                workspace_id=ws.id,
                user_id=user.id,
                title="Immediate Invoice Payment Due",
                description="Overdue invoice #9021 requires payment.",
                due_date=past_due,
                status="scheduled",
                is_confirmed=True,
                is_dismissed=False,
                notification_channels=["in_app"],
            )

            # 2. Snoozed reminder whose snooze time has now passed
            rem2 = Reminder(
                workspace_id=ws.id,
                user_id=user.id,
                title="Snoozed Compliance Filing",
                description="File quarterly report.",
                due_date=past_due - timedelta(days=1),
                snooze_until=past_due,
                status="snoozed",
                is_confirmed=True,
                is_dismissed=False,
                notification_channels=["in_app"],
            )

            # 3. Recurring due reminder
            rem3 = Reminder(
                workspace_id=ws.id,
                user_id=user.id,
                title="Daily Standup Checklist",
                description="Check tasks.",
                due_date=past_due,
                status="scheduled",
                recurrence_rule="FREQ=DAILY",
                is_confirmed=True,
                is_dismissed=False,
                notification_channels=["in_app"],
            )

            session.add_all([rem1, rem2, rem3])
            await session.commit()

            scheduler = ReminderScheduler()

            # First dispatch cycle
            dispatched = await scheduler.dispatch_due_reminders(session, current_time=now)
            assert dispatched == 3

            # Check status of one-time reminder -> sent
            await session.refresh(rem1)
            assert rem1.status == "sent"
            assert rem1.sent_at is not None

            # Check status of snoozed reminder -> sent
            await session.refresh(rem2)
            assert rem2.status == "sent"

            # Check recurring reminder -> recurrence advanced, status scheduled
            await session.refresh(rem3)
            assert rem3.status == "scheduled"
            assert rem3.due_date.replace(tzinfo=timezone.utc) > past_due

            # Check notifications created
            notif_stmt = select(Notification).where(Notification.workspace_id == ws.id)
            notifications = (await session.execute(notif_stmt)).scalars().all()
            assert len(notifications) == 3

            # Check notification deliveries with idempotency keys
            deliv_stmt = select(NotificationDelivery)
            deliveries = (await session.execute(deliv_stmt)).scalars().all()
            assert len(deliveries) == 3
            assert all(d.status == "delivered" for d in deliveries)

            # Idempotency check: run scheduler again with same timestamp -> 0 new notifications
            dispatched_again = await scheduler.dispatch_due_reminders(session, current_time=now)
            assert dispatched_again == 0

            notifications_after = (await session.execute(notif_stmt)).scalars().all()
            assert len(notifications_after) == 3

    asyncio.run(_test())
