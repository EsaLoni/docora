"""Extensible Notification Delivery Providers.

Defines the BaseNotificationProvider abstraction and concrete InAppNotificationProvider
with strict delivery idempotency.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import hashlib
from typing import Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.action import Notification, NotificationDelivery

logger = get_logger("services.actions.notifications")


class BaseNotificationProvider(ABC):
    """Abstract interface for multi-channel notification dispatchers."""

    @abstractmethod
    async def deliver(
        self,
        db: AsyncSession,
        notification: Notification,
        idempotency_key: str,
    ) -> bool:
        """Deliver the notification. Must be idempotent."""
        pass


class InAppNotificationProvider(BaseNotificationProvider):
    """In-app alert delivery provider. Records an audit entry in notification_deliveries."""

    async def deliver(
        self,
        db: AsyncSession,
        notification: Notification,
        idempotency_key: str,
    ) -> bool:
        """Create delivery record and confirm in-app availability."""
        # 1. Check if delivery attempt with this idempotency key already succeeded
        existing_stmt = select(NotificationDelivery).where(
            NotificationDelivery.idempotency_key == idempotency_key
        )
        existing = (await db.execute(existing_stmt)).scalar_one_or_none()
        if existing and existing.status == "delivered":
            logger.info("Delivery already completed for key %s (idempotent skip)", idempotency_key)
            return True

        # 2. Record new delivery
        try:
            now = datetime.now(timezone.utc)
            if existing:
                existing.status = "delivered"
                existing.delivered_at = now
                existing.attempt_count += 1
            else:
                delivery = NotificationDelivery(
                    notification_id=notification.id,
                    channel="in_app",
                    status="delivered",
                    idempotency_key=idempotency_key,
                    attempt_count=1,
                    delivered_at=now,
                )
                db.add(delivery)

            await db.flush()
            logger.info(
                "Delivered in-app notification %s for user %s",
                notification.id,
                notification.user_id,
            )
            return True
        except Exception as e:
            logger.error("Failed to deliver in-app notification %s: %s", notification.id, e)
            return False
