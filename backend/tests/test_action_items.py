"""Tests for Action Item CRUD and Lifecycle Management."""

import asyncio
from datetime import datetime, timedelta, timezone
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.document import Document
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.items import ActionItemService
from app.services.actions.models import (
    ActionItemCreate,
    ActionItemUpdate,
    ActionOrigin,
    ActionPriority,
    ActionStatus,
)


def test_create_action_item_and_reminder(session_factory: async_sessionmaker[AsyncSession]):
    """Verify manual creation of an action item and linked reminder."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            service = ActionItemService()
            due = datetime.now(timezone.utc) + timedelta(days=5)

            data = ActionItemCreate(
                title="Review Cloud Services Agreement",
                description="Check SLA obligations and penalty terms.",
                priority=ActionPriority.HIGH,
                due_date=due,
                create_reminder=True,
                reminder_lead_time_minutes=60,
            )

            item, reminder = await service.create_action_item(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                data=data,
            )

            assert item.id is not None
            assert item.title == "Review Cloud Services Agreement"
            assert item.priority == "high"
            assert item.status == "pending"
            assert item.origin == "manual"
            assert item.workspace_id == ws.id

            assert reminder is not None
            assert reminder.action_item_id == item.id
            assert reminder.workspace_id == ws.id
            assert reminder.status == "scheduled"
            assert reminder.due_date.replace(tzinfo=timezone.utc) == due - timedelta(minutes=60)

    asyncio.run(_test())


def test_action_item_lifecycle(session_factory: async_sessionmaker[AsyncSession]):
    """Verify complete, reopen, dismiss, update, and delete state transitions."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            service = ActionItemService()
            data = ActionItemCreate(
                title="Audit Vendor SOC2 Compliance",
                priority=ActionPriority.URGENT,
            )
            item, _ = await service.create_action_item(
                db=session,
                workspace_id=ws.id,
                user_id=user.id,
                data=data,
            )

            # 1. Complete item
            completed_item = await service.complete_action_item(session, item.id, ws.id)
            assert completed_item is not None
            assert completed_item.status == "completed"
            assert completed_item.completed_at is not None

            # 2. Reopen item
            reopened_item = await service.reopen_action_item(session, item.id, ws.id)
            assert reopened_item is not None
            assert reopened_item.status == "in_progress"
            assert reopened_item.completed_at is None

            # 3. Update item
            updated_item = await service.update_action_item(
                session, item.id, ws.id, ActionItemUpdate(title="Audit Vendor SOC2 Type II")
            )
            assert updated_item is not None
            assert updated_item.title == "Audit Vendor SOC2 Type II"

            # 4. Dismiss item
            dismissed_item = await service.dismiss_action_item(session, item.id, ws.id)
            assert dismissed_item is not None
            assert dismissed_item.status == "dismissed"

            # 5. Delete item
            deleted = await service.delete_action_item(session, item.id, ws.id)
            assert deleted is True

            fetched = await service.get_action_item(session, item.id, ws.id)
            assert fetched is None

    asyncio.run(_test())


def test_action_item_tenant_isolation(session_factory: async_sessionmaker[AsyncSession]):
    """Verify action items are strictly isolated to their workspace."""
    async def _test():
        async with session_factory() as session:
            user_a = User(id=uuid.uuid4(), email=f"usera-{uuid.uuid4().hex[:6]}@udip.local")
            ws_a = Workspace(id=uuid.uuid4(), name="WS A", slug=f"wsa-{uuid.uuid4().hex[:6]}", owner_id=user_a.id)

            user_b = User(id=uuid.uuid4(), email=f"userb-{uuid.uuid4().hex[:6]}@udip.local")
            ws_b = Workspace(id=uuid.uuid4(), name="WS B", slug=f"wsb-{uuid.uuid4().hex[:6]}", owner_id=user_b.id)

            session.add_all([user_a, ws_a, user_b, ws_b])
            await session.flush()

            service = ActionItemService()
            item_a, _ = await service.create_action_item(
                db=session,
                workspace_id=ws_a.id,
                user_id=user_a.id,
                data=ActionItemCreate(title="Confidential Workspace A Item"),
            )

            # Workspace B cannot see or manipulate Workspace A's item
            assert await service.get_action_item(session, item_a.id, ws_b.id) is None
            assert await service.complete_action_item(session, item_a.id, ws_b.id) is None
            assert await service.delete_action_item(session, item_a.id, ws_b.id) is False

            # Listing in Workspace B returns empty
            items_b, count_b = await service.get_action_items(session, workspace_id=ws_b.id)
            assert count_b == 0
            assert len(items_b) == 0

    asyncio.run(_test())
