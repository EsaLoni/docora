"""Tests for Notification Provider and Unread Status Management."""

import asyncio
from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.action import Notification, NotificationDelivery
from app.models.user import User
from app.models.workspace import Workspace
from app.services.actions.notification_provider import InAppNotificationProvider


def test_in_app_notification_delivery_and_idempotency(session_factory: async_sessionmaker[AsyncSession]):
    """Verify in-app notification provider logs delivery and honors idempotency keys."""
    async def _test():
        async with session_factory() as session:
            user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4().hex[:6]}@udip.local")
            ws = Workspace(id=uuid.uuid4(), name="Test WS", slug=f"ws-{uuid.uuid4().hex[:6]}", owner_id=user.id)
            session.add_all([user, ws])
            await session.flush()

            notif = Notification(
                workspace_id=ws.id,
                user_id=user.id,
                title="Contract Renewal Alert",
                message="Your contract renews in 3 days.",
                notification_type="reminder",
                is_read=False,
            )
            session.add(notif)
            await session.flush()

            provider = InAppNotificationProvider()
            idempotency_key = f"notif:{notif.id}:test_key_1"

            # 1. First delivery attempt -> succeeds
            res1 = await provider.deliver(session, notif, idempotency_key)
            assert res1 is True

            # Verify delivery row created
            stmt = select(NotificationDelivery).where(NotificationDelivery.idempotency_key == idempotency_key)
            delivery = (await session.execute(stmt)).scalar_one_or_none()
            assert delivery is not None
            assert delivery.status == "delivered"
            assert delivery.attempt_count == 1

            # 2. Second delivery attempt with same key -> skips duplicate
            res2 = await provider.deliver(session, notif, idempotency_key)
            assert res2 is True

            deliveries = (await session.execute(stmt)).scalars().all()
            assert len(deliveries) == 1

    asyncio.run(_test())
